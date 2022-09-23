import { existsSync } from 'node:fs';
import path from 'node:path';
import get from 'lodash.get';
import type { BrowserContextOptions, Page } from 'playwright';
import { loadTSProjectConfigFile } from './configHelper';
import { log } from './log';
import { ShotMode } from './types';

type BaseConfig = {
  /**
   * Browser to use: chromium, firefox, or webkit
   * @default 'chromium'
   */
  browser: 'chromium' | 'firefox' | 'webkit';

  /**
   * URL of the Lost Pixel API endpoint
   * @default 'https://app.lost-pixel.com'
   */
  lostPixelPlatform: string;

  /**
   * API key for the Lost Pixel platform
   */
  apiKey?: string;

  /**
   * Enable Storybook mode
   */
  storybookShots?: {
    /**
     * URL of the Storybook instance or local folder
     * @default 'storybook-static'
     */
    storybookUrl: string;

    /**
     * Define areas for all stories where differences will be ignored
     */
    mask?: Mask[];
  };

  /**
   * Enable Ladle mode
   */
  ladleShots?: {
    /**
     * URL of the Ladle served instance
     * @default 'http://localhost:61000'
     */
    ladleUrl: string;

    /**
     * Define areas for all stories where differences will be ignored
     */
    mask?: Mask[];
  };

  /**
   * Enable Page mode
   */
  pageShots?: {
    /**
     * Paths to take screenshots of
     */
    pages: PageScreenshotParameter[];

    /**
     * Base URL of the running application (e.g. http://localhost:3000)
     */
    baseUrl: string;

    /**
     * Define areas for all pages where differences will be ignored
     */
    mask?: Mask[];
  };

  /**
   * Enable Custom mode
   */
  customShots?: {
    /**
     * Path to current shots folder
     */
    currentShotsPath: string;
  };

  /**
   * Path to the baseline image folder
   * @default '.lostpixel/baseline/'
   */
  imagePathBaseline: string;

  /**
   * Path to the current image folder
   * @default '.lostpixel/current/'
   */
  imagePathCurrent: string;

  /**
   * Path to the difference image folder
   * @default '.lostpixel/difference/'
   */
  imagePathDifference: string;

  /**
   * Number of concurrent shots to take
   * @default 5
   */
  shotConcurrency: number;

  /**
   * Number of concurrent screenshots to compare
   * @default 10
   */
  compareConcurrency: number;

  /**
   * Timeouts for various stages of the test
   */
  timeouts: {
    /**
     * Timeout for fetching stories from Storybook
     * @default 30_000
     */
    fetchStories?: number;

    /**
     * Timeout for loading the state of the page
     * @default 30_000
     */
    loadState?: number;

    /**
     * Timeout for waiting for network requests to finish
     * @default 30_000
     */
    networkRequests?: number;
  };

  /**
   * Time to wait before taking a screenshot
   * @default 1_000
   */
  waitBeforeScreenshot: number;

  /**
   * Time to wait for the first network request to start
   * @default 1_000
   */
  waitForFirstRequest: number;

  /**
   * Time to wait for the last network request to start
   * @default 1_000
   */
  waitForLastRequest: number;

  /**
   * Threshold for the difference between the baseline and current image
   *
   * Values between 0 and 1 are interpreted as percentage of the image size
   *
   * Values greater or equal to 1 are interpreted as pixel count.
   * @default 0
   */
  threshold: number;

  /**
   * Whether to set the GitHub status check on process start or not
   *
   * Setting this option to `true` makes only sense if the repository settings have pending status checks disabled
   * @default 'false'
   */
  setPendingStatusCheck: boolean;
};

export type Mask = {
  /**
   * CSS selector for the element to mask
   * Examples:
   * - `#my-id`: Selects the element with the id `my-id`
   * - `.my-class`: Selects all elements with the class `my-class`
   * - `div`: Selects all `div` elements
   * - `div.my-class`: Selects all `div` elements with the class `my-class`
   * - `li:nth-child(2n)`: Selects all even `li` elements
   * - `[data-testid="hero-banner"]`: Selects all elements with the attribute `data-testid` set to `hero-banner`
   * - `div > p`: Selects all `p` elements that are direct children of a `div` element
   */
  selector: string;
};

export type PageScreenshotParameter = {
  /**
   * Path to the page to take a screenshot of (e.g. /login)
   */
  path: string;

  /**
   * Unique name for the page
   */
  name: string;

  /**
   * Time to wait before taking a screenshot
   * @default 1_000
   */
  waitBeforeScreenshot?: number;

  /**
   * Threshold for the difference between the baseline and current image
   *
   * Values between 0 and 1 are interpreted as percentage of the image size
   *
   * Values greater or equal to 1 are interpreted as pixel count.
   * @default 0
   */
  threshold?: number;

  /**
   * Define a custom viewport for the page
   * @default { width: 1280, height: 720 }
   */
  viewport?: {
    width?: number;
    height?: number;
  };

  /**
   * Define areas for the page where differences will be ignored
   */
  mask?: Mask[];
};

type StoryLike = {
  shotMode: ShotMode;
  id?: string;
  kind?: string;
  story?: string;
  shotName?: string;
  parameters?: Record<string, unknown>;
};

export type ProjectConfig = {
  /**
   * Project ID
   */
  lostPixelProjectId: string;

  /**
   * CI build ID
   */
  ciBuildId: string;

  /**
   * CI build number
   */
  ciBuildNumber: string;

  /**
   * Git repository name (e.g. 'lost-pixel/lost-pixel-storybook')
   */
  repository: string;

  /**
   * Git branch name (e.g. 'refs/heads/main')
   */
  commitRef: string;

  /**
   * Git branch name (e.g. 'main')
   */
  commitRefName: string;

  /**
   * Git commit SHA (e.g. 'b9b8b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9b9')
   */
  commitHash: string;

  /**
   * Flag that decides if images should be uploaded to S3 bucket or just generated (non-SaaS self-hosted mode)
   */
  generateOnly?: boolean;

  /**
   * Flag that decides if process should exit if a difference is found
   */
  failOnDifference?: boolean;

  /**
   * File path to event.json file
   */
  eventFilePath?: string;

  /**
   * Global shot filter
   */
  filterShot?: (input: StoryLike) => boolean;

  /**
   * Shot and file name generator for images
   */
  shotNameGenerator?: (input: StoryLike) => string;

  /**
   * Configure browser context options
   */
  configureBrowser?: (input: StoryLike) => BrowserContextOptions;

  /**
   * Configure page before screenshot
   */
  beforeScreenshot?: (page: Page, input: StoryLike) => Promise<void>;
};

type GenerateOnlyModeProjectConfig = Omit<
  ProjectConfig,
  | 'lostPixelProjectId'
  | 'ciBuildId'
  | 'ciBuildId'
  | 'ciBuildNumber'
  | 'repository'
  | 'commitRef'
  | 'commitRefName'
  | 'commitHash'
> &
  Partial<Pick<ProjectConfig, 'lostPixelProjectId'>> & {
    generateOnly: true;
  };

const requiredConfigProps: Array<keyof ProjectConfig> = [
  'lostPixelProjectId',
  'ciBuildId',
  'ciBuildNumber',
  'repository',
  'commitRef',
  'commitRefName',
  'commitHash',
];

export const MEDIA_UPLOAD_CONCURRENCY = 10;

export type FullConfig =
  | (BaseConfig & ProjectConfig)
  | (BaseConfig & GenerateOnlyModeProjectConfig);

export type CustomProjectConfig =
  | (Partial<BaseConfig> & GenerateOnlyModeProjectConfig)
  | (Partial<BaseConfig> & ProjectConfig);

const defaultConfig: BaseConfig = {
  browser: 'chromium',
  lostPixelPlatform: 'https://app.lost-pixel.com',
  imagePathBaseline: '.lostpixel/baseline/',
  imagePathCurrent: '.lostpixel/current/',
  imagePathDifference: '.lostpixel/difference/',
  shotConcurrency: 5,
  compareConcurrency: 10,
  timeouts: {
    fetchStories: 30_000,
    loadState: 30_000,
    networkRequests: 30_000,
  },
  waitBeforeScreenshot: 1000,
  waitForFirstRequest: 1000,
  waitForLastRequest: 1000,
  threshold: 0,
  setPendingStatusCheck: false,
};

const githubConfigDefaults: Partial<ProjectConfig> = {
  ciBuildId: process.env.GITHUB_RUN_ID,
  ciBuildNumber: process.env.GITHUB_RUN_NUMBER,
  repository: process.env.REPOSITORY,
  commitRef: process.env.GITHUB_REF,
  commitRefName: process.env.GITHUB_REF_NAME,
  commitHash: process.env.COMMIT_HASH,
};

export let config: FullConfig;

const checkConfig = () => {
  const missingProps: string[] = [];

  for (const prop of requiredConfigProps) {
    if (!get(config, prop)) {
      missingProps.push(prop);
    }
  }

  if (missingProps.length > 0) {
    log.process(
      'error',
      `Error: Missing required configuration properties: ${missingProps.join(
        ', ',
      )}`,
    );
    process.exit(1);
  }
};

const configDirBase = process.env.LOST_PIXEL_CONFIG_DIR ?? process.cwd();

const configFileNameBase = path.join(
  configDirBase.startsWith('/') ? '' : process.cwd(),
  configDirBase,
  'lostpixel.config',
);

const loadProjectConfig = async (): Promise<CustomProjectConfig> => {
  log.process('info', 'Loading project configuration...');
  log.process('info', 'Current working directory:', process.cwd());

  if (process.env.LOST_PIXEL_CONFIG_DIR) {
    log.process(
      'info',
      'Defined configuration directory:',
      process.env.LOST_PIXEL_CONFIG_DIR,
    );
  }

  log.process(
    'info',
    'Looking for configuration file:',
    `${configFileNameBase}.(js|ts)`,
  );

  if (existsSync(`${configFileNameBase}.js`)) {
    const projectConfig =
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      require(`${configFileNameBase}.js`) as CustomProjectConfig;

    return projectConfig;
  }

  if (existsSync(`${configFileNameBase}.ts`)) {
    try {
      const imported = (await loadTSProjectConfigFile(
        `${configFileNameBase}.ts`,
      )) as CustomProjectConfig;

      return imported;
    } catch (error: unknown) {
      log.process('error', error);
      log.process('error', 'Failed to load TypeScript configuration file');
      process.exit(1);
    }
  }

  log.process(
    'error',
    "Couldn't find project config file 'lostpixel.config.js'",
  );
  process.exit(1);
};

export const configure = async (customProjectConfig?: CustomProjectConfig) => {
  if (customProjectConfig) {
    config = {
      ...defaultConfig,
      ...customProjectConfig,
    };

    return;
  }

  const projectConfig = await loadProjectConfig();

  config = {
    ...(!projectConfig.generateOnly && { ...githubConfigDefaults }),
    ...defaultConfig,
    ...projectConfig,
  };

  // Default to Storybook mode if no mode is defined
  if (
    !config.storybookShots &&
    !config.pageShots &&
    !config.ladleShots &&
    !config.customShots
  ) {
    config.storybookShots = {
      storybookUrl: 'storybook-static',
    };
  }

  if (!config.generateOnly) {
    checkConfig();
  }
};
