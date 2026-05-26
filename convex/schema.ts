import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  searches: defineTable({
    city: v.string(),
    industry: v.string(),
    maxLeads: v.number(),
    status: v.string(), // "running" | "completed" | "error"
    errorMessage: v.optional(v.string()),
    isAutoscan: v.optional(v.boolean()),
    autoscanId: v.optional(v.id("autoscans")),
    createdAt: v.number(),
  }),

  leads: defineTable({
    searchId: v.id("searches"),
    name: v.string(), // Hotel name
    website: v.optional(v.string()), // Hotel URL
    ceo: v.optional(v.string()), // Geschäftsführer
    email: v.optional(v.string()), // Hotel Email
    phone: v.optional(v.string()), // Hotel Telefon
    address: v.optional(v.string()),
    ansprechpartner: v.optional(v.string()), // Ansprechpartner Name
    ansprechpartnerEmail: v.optional(v.string()), // Ansprechpartner Email
    ansprechpartnerPhone: v.optional(v.string()), // Ansprechpartner Telefon
    ansprechpartnerPosition: v.optional(v.string()),
    jobTitle: v.optional(v.string()), // Name der Stellenausschreibung
    jobUrl: v.optional(v.string()), // URL zur Jobausschreibung
    jobPostingsCount: v.optional(v.number()),
    source: v.string(),
    isNew: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_search", ["searchId"])
    .index("by_new", ["isNew", "createdAt"]),

  autoscans: defineTable({
    name: v.string(),
    cities: v.array(v.string()),
    maxLeadsPerCity: v.number(),
    frequency: v.string(), // "daily" | "weekly" | "monthly"
    status: v.string(), // "active" | "paused"
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    createdAt: v.number(),
  }),
});
