import "server-only";
import { Mastra } from "@mastra/core/mastra";
import { agents } from "./agents";
import { jevClassifier } from "./classifiers";

export const mastra = new Mastra({
  agents,
  classifiers: { jev: jevClassifier },
});
