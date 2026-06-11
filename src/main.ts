import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApplication } from './app.bootstrap';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const appConfigService = app.get(AppConfigService);
  configureApplication(app);

  await app.listen(appConfigService.port);
}

if (require.main === module) {
  void bootstrap();
}
