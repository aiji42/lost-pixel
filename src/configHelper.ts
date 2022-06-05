import { Service } from 'ts-node';
import { log } from './log';

let tsNodeService: Service;

export const setupTsNode = async (): Promise<Service> => {
  if (tsNodeService) {
    return tsNodeService;
  }

  try {
    const tsNode = await import('ts-node');

    tsNodeService = tsNode.register({
      transpileOnly: true,
    });

    return tsNodeService;
  } catch (error: unknown) {
    // @ts-expect-error Error type definition is missing 'code'
    if (['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(error.code)) {
      log(`Please install "ts-node" to use a TypeScript configuration file`);
      // @ts-expect-error Error type definition is missing 'message'
      log(error.message);
      process.exit(1);
    }

    throw error;
  }
};

export const loadTSProjectConfigFile = async (
  configFilepath: string,
): Promise<unknown> => {
  await setupTsNode();
  tsNodeService.enabled(true);
  const imported = require(configFilepath);
  tsNodeService.enabled(false);

  return imported.default || imported.config;
};
