import { z } from "zod";

export const OutlineSchema = z.object({
  outline: z
    .array(
      z.object({
        title: z.string(), // mavzu tilida
        title_eng: z.string(), // ingliz tilida
      })
    )
    .min(3)
    .max(3), // 3 ta asosiy mavzu
  slides: z.array(
    z.object({
      slideIndex: z.number().int().min(0), // original slides arraydan index (0 dan boshlanadi)
      title: z.string(), // mavzu tilida
      title_eng: z.string(), // ingliz tilida
      outlineIndex: z.number().int().min(0).max(2), // qaysi outline punktiga tegishli (0-2)
    })
  ),
});

export type OutlineResponse = z.infer<typeof OutlineSchema>;
