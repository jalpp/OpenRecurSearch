import "server-only";
import { Classifier } from "@mastra/core/classifier";
import { jevModel } from "./models";

export const jevClassifier = new Classifier({
  id: "jev-recursearch",
  model: jevModel(),
});
