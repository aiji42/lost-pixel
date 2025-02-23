import path from 'node:path';
import axios from 'axios';
import { log } from '../log';
import { config } from '../config';
import { type ShotItem } from '../types';

type HistoireStory = {
  id: string;
  title: string;
  group: string | undefined;
  layout: {
    type: string;
    width: string;
  };
  variants?: HistoireStory[];
};

type HistoireResponse = {
  stories: HistoireStory[];
};

const generateShotItemsForStory = (
  story: HistoireStory,
  baseUrl: string,
): ShotItem[] => {
  const shotItems: ShotItem[] = [];

  // Treat stories without variants as if they had a single variant
  const variants = story.variants ?? [story];

  for (const variant of variants) {
    const variantShotName = variant.title;

    shotItems.push({
      shotMode: 'histoire',
      id: variant.id,
      shotName: variantShotName,
      url: `${baseUrl}/__sandbox.html?storyId=${story.id}&variantId=${variant.id}`,
      filePathBaseline: path.join(
        config.imagePathBaseline,
        `${variantShotName}.png`,
      ),
      filePathCurrent: path.join(
        config.imagePathCurrent,
        `${variantShotName}.png`,
      ),
      filePathDifference: path.join(
        config.imagePathDifference,
        `${variantShotName}.png`,
      ),
      threshold: config.threshold,
    });
  }

  return shotItems.filter((story) => story.id !== 'full-config');
};

export const generateHistoireShotItems = (
  baseUrl: string,
  stories: HistoireStory[],
): ShotItem[] => {
  return stories.flatMap((story) => generateShotItemsForStory(story, baseUrl));
};

export const collectHistoireStories = async (histoireUrl: string) => {
  const jsonUrl = `${histoireUrl}/histoire.json`;

  log.process('info', 'general', `\n=== [Histoire Mode] ${jsonUrl} ===\n`);
  const response = await axios.get<HistoireResponse>(jsonUrl);

  // Ignore the full-config story from Histoire as it is just JSON
  return response.data.stories;
};
