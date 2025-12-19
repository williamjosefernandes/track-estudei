import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Estudei Track API')
    .setDescription('API do Estudei Track')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document);

  // Endpoint para baixar a Collection v2.1 do Postman gerada a partir do OpenAPI
  const adapter = app.getHttpAdapter();
  adapter.get('/docs/postman-collection.json', async (req, res) => {
    try {
      // Usa import dinâmico para evitar regras de lint sobre require
      const openapiToPostman = (await import('openapi-to-postmanv2')) as any;

      openapiToPostman.convert(
        { type: 'json', data: document },
        {
          collectionName: (document as any)?.info?.title || 'Sou Instrutor API',
          strictValidation: false,
          schemaFaker: true,
        },
        (err: any, result: any) => {
          if (err) {
            res.status(500).json({
              message: 'Conversion error',
              error: String(err),
            });
            return;
          }

          if (!result || !result.result) {
            res.status(500).json({
              message: 'Conversion failed',
              reason: result && result.reason,
            });
            return;
          }

          const collection = result.output[0].data;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader(
            'Content-Disposition',
            'attachment; filename="postman_collection_v2.1.json"',
          );
          res.send(JSON.stringify(collection, null, 2));
        },
      );
    } catch (e) {
      res.status(500).json({
        message: 'Unexpected error during conversion',
        error: String(e),
      });
    }
  });

  app.enableCors({
    origin: [
      '*',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
      'http://localhost:5176',
      'http://localhost:5177',
      'https://souinstrutor.com.br',
      'https://www.souinstrutor.com.br',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port);

  Logger.log(`Aplicativo iniciado com sucesso na porta ${port}`);
}

bootstrap();
