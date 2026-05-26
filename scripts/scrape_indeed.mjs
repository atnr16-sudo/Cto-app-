#!/usr/bin/env node

import { chromium } from "playwright";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/opt/browsers/chromium-1217/chrome-linux64/chrome";

async function main() {
  const city = process.argv[2];
  const maxLeads = parseInt(process.argv[3] || "10", 10);
  const outputFile = process.argv[4] || "output.json";

  if (!city) {
    console.error("Usage: node scrape_indeed.mjs <city> <maxLeads> <outputFile>");
    process.exit(1);
  }

  console.log(`Starting search for hotels in ${city}, max ${maxLeads} leads...`);

  let browser;
  try {
    browser = await chromium.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "de-DE",
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();
    page.setDefaultTimeout(30000);

    // Step 1: Search Indeed for hotel jobs
    const indeedUrl = `https://de.indeed.com/jobs?q=Hotel&l=${encodeURIComponent(city)}&sort=date`;
    console.log(`Navigating to: ${indeedUrl}`);

    await page.goto(indeedUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(3000);

    // Try to accept cookies if present
    try {
      const cookieBtn = await page.$('[data-testid="cookie-consent-accept"]');
      if (cookieBtn) {
        await cookieBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      // Cookie consent may not be present
    }

    // Scroll down to load more results
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(1000);

    // Extract job data
    const companies = await page.evaluate(() => {
      const companyMap = {};

      const jobCards = document.querySelectorAll(
        '[data-testid="job-listing-item"], .job_seen_beacon, .tapItem, [class*="jobCard"], .result, li[class*="job"]',
      );

      jobCards.forEach((card) => {
        const companyEl =
          card.querySelector('[data-testid="company-name"]') ||
          card.querySelector(".companyName") ||
          card.querySelector('[class*="company"]');

        const titleEl =
          card.querySelector("h2") ||
          card.querySelector('[data-testid="job-title"]') ||
          card.querySelector(".jobTitle") ||
          card.querySelector("a[data-jk]");

        const company = companyEl?.textContent?.trim()?.replace(/^\d+\s*/, "") || "";
        const title = titleEl?.textContent?.trim() || "";

        if (company && title) {
          if (!companyMap[company]) {
            companyMap[company] = { name: company, count: 0, jobTitles: [] };
          }
          companyMap[company].count++;
          companyMap[company].jobTitles.push(title);
        }
      });

      return Object.values(companyMap);
    });

    console.log(`Found ${companies.length} unique companies on Indeed`);

    // Step 2: For each company, search for more info
    const leads = [];
    for (let i = 0; i < Math.min(companies.length, maxLeads); i++) {
      const company = companies[i];
      console.log(`Processing ${i + 1}/${Math.min(companies.length, maxLeads)}: ${company.name}`);

      const info = await searchCompanyInfo(page, company.name, city);
      leads.push({
        name: company.name,
        website: info.website || null,
        ceo: info.ceo || null,
        email: info.email || null,
        phone: info.phone || null,
        address: info.address || null,
        jobPostingsCount: company.count,
        source: `Indeed.de - ${company.count} Stellenanzeigen`,
      });

      await page.waitForTimeout(1000);
    }

    const fs = await import("fs/promises");
    await fs.writeFile(outputFile, JSON.stringify(leads, null, 2), "utf-8");

    console.log(`Done! Found ${leads.length} leads. Output written to ${outputFile}`);
  } catch (err) {
    console.error("Fatal error:", err.message);
    const fs = await import("fs/promises");
    await fs.writeFile(outputFile, JSON.stringify([]), "utf-8");
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

async function searchCompanyInfo(page, companyName, city) {
  const result = {
    website: null,
    ceo: null,
    email: null,
    phone: null,
    address: null,
  };

  try {
    const searchQuery = `${companyName} Hotel ${city} offizielle Website`;
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&hl=de`,
      { waitUntil: "domcontentloaded", timeout: 15000 },
    );
    await page.waitForTimeout(1500);

    const links = await page.evaluate(() => {
      const found = [];
      const anchors = document.querySelectorAll("a[href]");
      for (const a of anchors) {
        const href = a.href;
        if (
          href &&
          !href.includes("google.com") &&
          !href.includes("facebook.com") &&
          !href.includes("instagram.com") &&
          !href.includes("linkedin.com") &&
          !href.includes("xing.com") &&
          !href.includes("youtube.com") &&
          !href.includes("booking.com") &&
          !href.includes("tripadvisor") &&
          !href.includes("maps.google") &&
          (href.startsWith("https://") || href.startsWith("http://"))
        ) {
          found.push(href);
        }
      }
      return found.slice(0, 5);
    });

    if (links.length > 0) {
      result.website = links[0];
    }

    const ceoText = await page.evaluate(() => {
      const kpSelectors = [
        '[data-attrid*="Geschäftsführer"]',
        '[data-attrid*="Inhaber"]',
        '[data-attrid*="CEO"]',
        '[data-attrid*="Direktor"]',
        ".kno-rdesc span",
        ".hgKElc",
        ".sXLaOe",
        ".iKJnec",
      ];

      for (const sel of kpSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent) return el.textContent;
      }

      const snippets = document.querySelectorAll(".g .VwiC3b, .st");
      for (const s of snippets) {
        const text = s.textContent || "";
        if (
          text.includes("Geschäftsführer") ||
          text.includes("Inhaber") ||
          text.includes("CEO") ||
          text.includes("Direktor")
        ) {
          return text;
        }
      }

      return null;
    });

    if (ceoText) {
      const match = ceoText.match(
        /(?:Geschäftsführer|Inhaber|Direktor|CEO)[:\s]+([^,.]+)/i,
      );
      if (match) {
        result.ceo = match[1].trim();
      }
    }

    const contactQuery = `${companyName} Hotel ${city} Telefon Email Kontakt`;
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(contactQuery)}&hl=de`,
      { waitUntil: "domcontentloaded", timeout: 15000 },
    );
    await page.waitForTimeout(1500);

    const contactInfo = await page.evaluate(() => {
      const text = document.body?.innerText || "";

      const phoneRegex =
        /(?:0[\d\s\-/()]{6,20}|(?:\+49[\s\-/()]?\d[\d\s\-/()]{6,20}))/g;
      const phones = text.match(phoneRegex);

      const emailRegex = /[\w._%+-]+@[\w.-]+\.[\w]{2,}/g;
      const emails = text.match(emailRegex);

      const addressRegex =
        /(?:Straße|Strasse|Allee|Weg|Platz|Gasse|Ring|Chaussee)\s[\d\w\s,.-]{3,50}(?:\d{5})/i;
      const addressMatch = text.match(addressRegex);

      return {
        phone: phones
          ? phones.filter((p) => p.length >= 8).slice(0, 3).join(", ")
          : null,
        email: emails ? emails.slice(0, 3).join(", ") : null,
        address: addressMatch ? addressMatch[0].trim() : null,
      };
    });

    result.phone = contactInfo.phone;
    result.email = contactInfo.email;
    result.address = contactInfo.address;

    return result;
  } catch (err) {
    console.error(`Error searching info for ${companyName}:`, err.message);
    return result;
  }
}

main();
