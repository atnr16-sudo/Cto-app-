import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ─── SINGLE SEARCH ───────────────────────────────────────────────

export const startSearch = mutation({
  args: { city: v.string(), industry: v.string(), maxLeads: v.number() },
  returns: v.id("searches"),
  handler: async (ctx, args) => {
    const searchId = await ctx.db.insert("searches", {
      city: args.city,
      industry: args.industry || "Hotel",
      maxLeads: Math.min(args.maxLeads, 50),
      status: "running",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.search.scrapeHotels, {
      searchId, city: args.city, maxLeads: Math.min(args.maxLeads, 50),
    });
    return searchId;
  },
});

// ─── AUTOSCAN CRUD ───────────────────────────────────────────────

export const createAutoscan = mutation({
  args: {
    name: v.string(),
    cities: v.array(v.string()),
    maxLeadsPerCity: v.number(),
    frequency: v.string(),
  },
  returns: v.id("autoscans"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const intervals: Record<string, number> = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
    const interval = intervals[args.frequency] || 86400000;

    const autoscanId = await ctx.db.insert("autoscans", {
      name: args.name,
      cities: args.cities,
      maxLeadsPerCity: Math.min(args.maxLeadsPerCity, 50),
      frequency: args.frequency,
      status: "active",
      lastRunAt: undefined,
      nextRunAt: now + interval, // First run after the selected interval
      createdAt: now,
    });

    // Schedule first run
    await ctx.scheduler.runAfter(60000, internal.leads.runAutoscan, { autoscanId });
    return autoscanId;
  },
});

export const updateAutoscan = mutation({
  args: {
    autoscanId: v.id("autoscans"),
    name: v.optional(v.string()),
    cities: v.optional(v.array(v.string())),
    maxLeadsPerCity: v.optional(v.number()),
    frequency: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.cities !== undefined) patch.cities = args.cities;
    if (args.maxLeadsPerCity !== undefined) patch.maxLeadsPerCity = Math.min(args.maxLeadsPerCity, 50);
    if (args.frequency !== undefined) patch.frequency = args.frequency;
    if (args.status !== undefined) patch.status = args.status;
    await ctx.db.patch(args.autoscanId, patch);
    return null;
  },
});

export const deleteAutoscan = mutation({
  args: { autoscanId: v.id("autoscans") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.autoscanId);
    return null;
  },
});

export const listAutoscans = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("autoscans"), _creationTime: v.number(),
    name: v.string(), cities: v.array(v.string()),
    maxLeadsPerCity: v.number(), frequency: v.string(),
    status: v.string(), lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()), createdAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("autoscans").order("desc").collect();
  },
});

// ─── RUN AUTOSCAN (internal, scheduled) ──────────────────────────

export const runAutoscan = internalMutation({
  args: { autoscanId: v.id("autoscans") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const autoscan = await ctx.db.get(args.autoscanId);
    if (!autoscan || autoscan.status !== "active") return null;

    const now = Date.now();
    const maxLeads = autoscan.maxLeadsPerCity;

    // Create searches for each city
    for (const city of autoscan.cities) {
      const searchId = await ctx.db.insert("searches", {
        city, industry: "Hotel", maxLeads,
        status: "running", isAutoscan: true,
        autoscanId: args.autoscanId, createdAt: now,
      });
      await ctx.scheduler.runAfter(0, internal.search.scrapeHotels, {
        searchId, city, maxLeads,
      });
    }

    // Calculate next run
    const intervals: Record<string, number> = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
    const interval = intervals[autoscan.frequency] || 86400000;
    const nextRunAt = now + interval;

    await ctx.db.patch(args.autoscanId, {
      lastRunAt: now,
      nextRunAt,
    });

    // Schedule next run
    await ctx.scheduler.runAfter(interval, internal.leads.runAutoscan, { autoscanId: args.autoscanId });

    return null;
  },
});

// ─── INTERNAL: SAVE LEAD ─────────────────────────────────────────

export const saveLead = internalMutation({
  args: {
    searchId: v.id("searches"), name: v.string(),
    website: v.optional(v.string()), ceo: v.optional(v.string()),
    email: v.optional(v.string()), phone: v.optional(v.string()),
    address: v.optional(v.string()),
    ansprechpartner: v.optional(v.string()),
    ansprechpartnerEmail: v.optional(v.string()),
    ansprechpartnerPhone: v.optional(v.string()),
    ansprechpartnerPosition: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobUrl: v.optional(v.string()),
    jobPostingsCount: v.optional(v.number()), source: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("leads", {
      searchId: args.searchId, name: args.name,
      website: args.website, ceo: args.ceo,
      email: args.email, phone: args.phone,
      address: args.address,
      ansprechpartner: args.ansprechpartner,
      ansprechpartnerEmail: args.ansprechpartnerEmail,
      ansprechpartnerPhone: args.ansprechpartnerPhone,
      ansprechpartnerPosition: args.ansprechpartnerPosition,
      jobTitle: args.jobTitle,
      jobUrl: args.jobUrl,
      jobPostingsCount: args.jobPostingsCount, source: args.source,
      isNew: true, createdAt: Date.now(),
    });
    return null;
  },
});

export const updateSearchStatus = internalMutation({
  args: { searchId: v.id("searches"), status: v.string(), errorMessage: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.searchId, {
      status: args.status,
      ...(args.errorMessage ? { errorMessage: args.errorMessage } : {}),
    });
    return null;
  },
});

// ─── QUERIES ──────────────────────────────────────────────────────

export const getSearch = query({
  args: { searchId: v.id("searches") },
  returns: v.union(v.null(), v.object({
    _id: v.id("searches"), _creationTime: v.number(),
    city: v.string(), industry: v.string(), maxLeads: v.number(),
    status: v.string(), errorMessage: v.optional(v.string()),
    isAutoscan: v.optional(v.boolean()), autoscanId: v.optional(v.id("autoscans")),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => await ctx.db.get(args.searchId),
});

export const listSearches = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("searches"), _creationTime: v.number(),
    city: v.string(), industry: v.string(), maxLeads: v.number(),
    status: v.string(), errorMessage: v.optional(v.string()),
    isAutoscan: v.optional(v.boolean()),
    createdAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db.query("searches").order("desc").collect();
  },
});

export const getLeads = query({
  args: { searchId: v.id("searches") },
  returns: v.array(v.object({
    _id: v.id("leads"), _creationTime: v.number(),
    searchId: v.id("searches"), name: v.string(),
    website: v.optional(v.string()), ceo: v.optional(v.string()),
    email: v.optional(v.string()), phone: v.optional(v.string()),
    address: v.optional(v.string()),
    ansprechpartner: v.optional(v.string()),
    ansprechpartnerEmail: v.optional(v.string()),
    ansprechpartnerPhone: v.optional(v.string()),
    ansprechpartnerPosition: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobUrl: v.optional(v.string()),
    jobPostingsCount: v.optional(v.number()), source: v.string(),
    isNew: v.boolean(), createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_search", (q) => q.eq("searchId", args.searchId))
      .order("desc")
      .collect();
  },
});

    /** Count new leads */
export const countNewLeads = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_new", (q) => q.eq("isNew", true))
      .collect();
    return leads.length;
  },
});

/** Get all new leads */
export const getNewLeads = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("leads"), _creationTime: v.number(),
    searchId: v.id("searches"), name: v.string(),
    website: v.optional(v.string()), ceo: v.optional(v.string()),
    email: v.optional(v.string()), phone: v.optional(v.string()),
    address: v.optional(v.string()),
    ansprechpartner: v.optional(v.string()),
    ansprechpartnerEmail: v.optional(v.string()),
    ansprechpartnerPhone: v.optional(v.string()),
    ansprechpartnerPosition: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    jobUrl: v.optional(v.string()),
    jobPostingsCount: v.optional(v.number()), source: v.string(),
    isNew: v.boolean(), createdAt: v.number(),
  })),
  handler: async (ctx) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_new", (q) => q.eq("isNew", true))
      .order("desc")
      .collect();
  },
});
