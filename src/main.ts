import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as hbsModule from 'hbs';
import { join } from 'path';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

const hbsApi = hbsModule as unknown as {
  registerPartials?: (path: string) => void;
  default?: {
    registerPartials?: (path: string) => void;
  };
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const appConfigService = app.get(AppConfigService);

  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('hbs');
  app.useStaticAssets(join(__dirname, '..', 'public'));
  if (hbsApi.registerPartials) {
    hbsApi.registerPartials(join(__dirname, '..', 'views', 'partials'));
  } else {
    hbsApi.default?.registerPartials?.(
      join(__dirname, '..', 'views', 'partials'),
    );
  }

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(appConfigService.port);
}

void bootstrap();
