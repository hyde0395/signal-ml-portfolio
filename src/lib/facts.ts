import { z } from 'zod';
import raw from '../../data/facts.json';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const score = z.object({ r2: z.number(), mae: z.number(), mape: z.number() });
const chapters = ['problem', 'insight', 'bubble', 'validation', 'interval', 'limits'] as const;
export type CodeChapter = (typeof chapters)[number];

export const factsSchema = z.object({
  dataVersion: isoDate,
  profile: z.object({ graduation: z.string().regex(/^\d{4}-\d{2}$/) }),
  contact: z.object({
    emailReversed: z.string().includes('@'),
    github: z.url(),
    linkedin: z.union([z.literal(''), z.url()]),
  }),
  codeLinks: z.object({
    baseUrl: z.url(),
    paths: z.object(Object.fromEntries(chapters.map((c) => [c, z.string().min(1)])) as Record<CodeChapter, z.ZodString>),
  }),
  data: z.object({
    rawRows: z.number().int(), filteredRows: z.number().int(), removedImplausible: z.number().int(),
    collectStart: isoDate, collectEnd: isoDate, departStart: isoDate, departEnd: isoDate,
    uniqueDepartures: z.number().int(), maxDtd: z.number().int(), routes: z.number().int(),
  }),
  model: z.object({
    tss: score, kfold: score, gkfNoLookup: score, gkfWithLookup: score,
    baselineMae: z.number(), lookupVariants: z.number().int(), optunaTrials: z.number().int(), testFiles: z.number().int(),
    interval: z.object({ level: z.number(), coverage: z.number(), driftLow: z.number() }),
    bubble: z.object({
      firstR2: z.number(), r2Before: z.number(), r2After: z.number(),
      maeBefore: z.number(), maeAfter: z.number(), denomShare: z.number(),
    }),
    reco: z.object({ buyNow: z.number(), dropExpected: z.number(), wait: z.number(), simulations: z.number().int() }),
    realizedFlights: z.number().int(),
    curveWidth: z.number(),
    bookingCurve: z.array(z.object({ label: z.string(), pct: z.number() })).length(8),
  }),
});

export type Facts = z.infer<typeof factsSchema>;

export const facts: Facts = factsSchema.parse(raw);

export function codeUrl(chapter: CodeChapter): string {
  return `${facts.codeLinks.baseUrl}/${facts.codeLinks.paths[chapter]}`;
}
