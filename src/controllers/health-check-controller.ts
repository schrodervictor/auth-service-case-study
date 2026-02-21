import { controller } from 'inversify-express-utils';
import { BaseController } from '../lib/base-controller';

@controller('/health-check')
export class HealthCheckController extends BaseController {}
