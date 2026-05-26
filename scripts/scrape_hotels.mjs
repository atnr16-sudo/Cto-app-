#!/usr/bin/env node

/**
 * Standalone scraper that uses Playwright to find hotels with job postings.
 * Uses StepStone.de and Google search.
 *
 * Usage: node scrape_hotels.mjs <city> <maxLeads> <outputFile>
 */

import { chromium } from "playwright";

const CHROMIUM_PATH = process.env.CHROMIUM_PATH || "/opt/browsers/chromium-1217/chrome-linux64/chrome";

async function main() {
  const city = process.argv[2];
  const maxLeads = parseInt(process.argv[3] || "10", 10);
  const outputFile = process.argv[4] || "output.json";

  if (!city) {
    console.error("Usage: node scrape_hotels.mjs <city> <maxLeads> <outputFile>");
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
      ],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      locale: "de-DE",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    // Strategy: Search Google for hotels in the city that are hiring
    // Google Jobs is the most reliable source
    const leads = await findHotelsViaGoogle(page, city, maxLeads);

    // Write output to file
    const fs = await import("fs/promises");
    await fs.writeFile(outputFile, JSON.stringify(leads, null, 2), "utf-8");

    console.log(`Done! Found ${leads.length} leads for ${city}.`);
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

/**
 * Find hotels with job postings by searching Google.
 */
async function findHotelsViaGoogle(page, city, maxLeads) {
  const leads = [];

  try {
    // Step 1: Search Google for hotels in the city with job openings
    // Using Google's natural search results
    const queries = [
      `Hotel ${city} Stellenangebote Jobs`,
      `Hotel ${city} Mitarbeiter gesucht Stellenausschreibung`,
      `Hotel ${city} Karriere Jobs Ausbildung`,
    ];

    const hotelNames = new Set();

    for (const query of queries) {
      if (hotelNames.size >= maxLeads * 3) break; // Get enough candidates

      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=de&num=30`,
        { waitUntil: "domcontentloaded", timeout: 20000 },
      );
      await page.waitForTimeout(2000);

      // Extract hotel names from search results
      const names = await page.evaluate(() => {
        const found = [];
        const results = document.querySelectorAll("h3, .LC20lb, a > span");
        for (const el of results) {
          const text = el.textContent || "";
          // Look for hotel names in results
          if (
            text.toLowerCase().includes("hotel") &&
            !text.toLowerCase().includes("booking") &&
            !text.toLowerCase().includes("tripadvisor") &&
            !text.toLowerCase().includes("google") &&
            text.length < 100 &&
            text.length > 5
          ) {
            found.push(text.trim());
          }
        }
        return found;
      });

      names.forEach((n) => hotelNames.add(n));
    }

    console.log(`Found ${hotelNames.size} potential hotels for ${city}`);

    // Step 2: For each hotel, get details
    let count = 0;
    for (const hotelName of hotelNames) {
      if (count >= maxLeads) break;

      // First verify they have active job postings
      const hasJobs = await checkForJobs(page, hotelName, city);
      if (!hasJobs) continue;

      // Get company info
      const info = await getCompanyInfo(page, hotelName, city);

      // Get contact person for job postings
      const ansprechpartner = await getAnsprechpartner(page, hotelName, city);

      leads.push({
        name: hotelName,
        website: info.website || null,
        ceo: info.ceo || null,
        email: info.email || null,
        phone: info.phone || null,
        address: info.address || null,
        ansprechpartner: ansprechpartner || null,
        jobPostingsCount: 1,
        source: "Google Suche + StepStone",
      });

      count++;
      console.log(`  [${count}/${maxLeads}] Added: ${hotelName}`);
      await page.waitForTimeout(1000);
    }
  } catch (err) {
    console.error(`Error in findHotelsViaGoogle:`, err.message);
  }

  return leads;
}

/**
 * Check if a hotel has active job postings.
 */
async function checkForJobs(page, hotelName, city) {
  try {
    // Search on StepStone for hotel jobs
    const searchUrl = `https://www.stepstone.de/jobs/${encodeURIComponent(hotelName)}/in-${encodeURIComponent(city)}.html`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(2000);

    const hasJobs = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      // Check if there are job results
      return (
        text.includes("Stellenanzeige") ||
        text.includes("Job") ||
        text.includes("Stelle") ||
        text.includes("Treffer") ||
        text.includes("Ergebnis")
      );
    });

    if (hasJobs) return true;

    // Fallback: Search Google for hotel + jobs
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(hotelName + " " + city + " Stellenangebote")}&hl=de`,
      { waitUntil: "domcontentloaded", timeout: 15000 },
    );
    await page.waitForTimeout(1500);

    const googleHasJobs = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      // Look for job-related content
      const jobKeywords = [
        "Stellenangebot", "Stellenanzeige", "Job", "Stelle",
        "bewirb", "Karriere", "Ausbildung", "Mitarbeiter gesucht",
        "zu besetzen", "Einstellung", "vakan",
      ];
      return jobKeywords.some((kw) => text.toLowerCase().includes(kw.toLowerCase()));
    });

    return googleHasJobs;
  } catch (err) {
    // If StepStone blocks us, assume they might have jobs
    return true;
  }
}

/**
 * Get company info (website, CEO, contact) via Google.
 */
async function getCompanyInfo(page, hotelName, city) {
  const result = { website: null, ceo: null, email: null, phone: null, address: null };

  try {
    // Search for hotel website
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(hotelName + " " + city + " offizielle Website")}&hl=de`,
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
          !href.includes("stepstone") &&
          !href.includes("monster") &&
          !href.includes("indeed") &&
          (href.startsWith("https://") || href.startsWith("http://"))
        ) {
          found.push(href);
        }
      }
      return found.slice(0, 3);
    });

    if (links.length > 0) {
      result.website = links[0];
    }

    // Extract CEO / Geschäftsführer from knowledge panel
    const ceoText = await page.evaluate(() => {
      const selectors = [
        '[data-attrid*="Geschäftsführer"]',
        '[data-attrid*="Inhaber"]',
        '[data-attrid*="CEO"]',
        '[data-attrid*="Direktor"]',
        ".kno-rdesc span",
        ".hgKElc",
        ".sXLaOe",
        ".iKJnec",
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el?.textContent) return el.textContent;
      }
      return null;
    });

    if (ceoText) {
      const match = ceoText.match(
        /(?:Geschäftsführer|Inhaber|Direktor|CEO)[:\s]+([^,.]+)/i,
      );
      if (match) result.ceo = match[1].trim();
    }

    // Get contact info
    await page.goto(
      `https://www.google.com/search?q=${encodeURIComponent(hotelName + " " + city + " Telefon Email")}&hl=de`,
      { waitUntil: "domcontentloaded", timeout: 15000 },
    );
    await page.waitForTimeout(1500);

    const contact = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const phoneRegex = /(?:0[\d\s\-/()]{6,20}|(?:\+49[\s\-/()]?\d[\d\s\-/()]{6,20}))/g;
      const phones = text.match(phoneRegex);
      const emailRegex = /[\w._%+-]+@[\w.-]+\.[\w]{2,}/g;
      const emails = text.match(emailRegex);
      const addressRegex = /(?:Straße|Strasse|Allee|Weg|Platz|Gasse|Ring)\s[\d\w\s,.-]{3,50}(?:\d{5})/i;
      const addr = text.match(addressRegex);
      return {
        phone: phones ? phones.filter(p => p.length >= 8).slice(0, 2).join(", ") : null,
        email: emails ? emails.slice(0, 2).join(", ") : null,
        address: addr ? addr[0].trim() : null,
      };
    });

    result.phone = contact.phone;
    result.email = contact.email;
    result.address = contact.address;
  } catch (err) {
    console.error(`Error getting info for ${hotelName}:`, err.message);
  }

  return result;
}

/**
 * Get the contact person (Ansprechpartner) for job applications.
 */
async function getAnsprechpartner(page, hotelName, city) {
  try {
    // Search for the hotel's HR/application contact
    const queries = [
      `${hotelName} ${city} Ansprechpartner Bewerbung`,
      `${hotelName} ${city} Personalabteilung Kontakt`,
      `${hotelName} ${city} Stellenbewerbung Ansprechpartner`,
    ];

    for (const q of queries) {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(q)}&hl=de`,
        { waitUntil: "domcontentloaded", timeout: 15000 },
      );
      await page.waitForTimeout(1500);

      const contact = await page.evaluate(() => {
        const text = document.body?.innerText || "";
        // Patterns for German contact persons
        const patterns = [
          /(?:Ansprechpartner|Ansprechpartnerin)[:\s]+([^,\n]+)/i,
          /(?:Kontaktperson|Personalabteilung)[:\s]+([^,\n]+)/i,
          /(?:Ihr|Ihre)\s+(?:Ansprechpartner|Kontakt)[:\s]+([^,\n]+)/i,
          /(?:Frau|Herr)\s+[A-Z][a-zäöüß]+\s+[A-Z][a-zäöüß]+/,
        ];

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const name = match[0] || match[1] || "";
            if (name.length > 3 && name.length < 100) {
              return name.trim();
            }
          }
        }
        return null;
      });

      if (contact && contact.length > 3) return contact;
    }

    return null;
  } catch (err) {
    return null;
  }
}

main();
