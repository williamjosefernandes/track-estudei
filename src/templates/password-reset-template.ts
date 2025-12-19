export const passwordTemplate = (
  url: string,
  name: string,
  systemName: string,
) => `
<!DOCTYPE html>
<html lang="pt-BR">
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Redefinição de Senha - ${systemName}</title>
        <style>
            body, table, td, div {
                margin: 0;
                padding: 0;
                line-height: 1.6;
            }
            
            body {
                width: 100% !important;
                background: #f6f9fc;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, sans-serif;
                color: #3d4852;
            }

            .container {
                max-width: 600px;
                margin: 0 auto;
                padding: 20px 10px;
            }

            .content {
                background: #ffffff;
                border-radius: 8px;
                padding: 40px 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }

            .header {
                text-align: center;
                padding-bottom: 30px;
                border-bottom: 1px solid #e8e5ef;
            }

            .logo {
                height: 35px;
                width: auto;
            }

            .title {
                font-size: 24px;
                color: #1a1a1a;
                margin: 30px 0;
                line-height: 1.3;
                text-align: center;
            }

            .button {
                display: inline-block;
                padding: 12px 30px;
                background: #2563EB;
                color: #ffffff !important;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 500;
                margin: 25px 0;
                transition: background 0.3s ease;
            }

            .button:hover {
                background: #1d4ed8 !important;
            }

            .footer {
                margin-top: 40px;
                padding-top: 30px;
                border-top: 1px solid #e8e5ef;
                font-size: 14px;
                color: #666666;
            }

            .url-container {
                word-break: break-all;
                background: #f8f9fa;
                padding: 15px;
                border-radius: 6px;
                margin: 20px 0;
                font-size: 14px;
                color: #495057;
            }
        </style>
    </head>

    <body>
        <div class="container">
            <div class="content">
                <div class="header">
                    <img src="cid:logo" alt="${systemName}" class="logo" style="height: 45px">
                </div>

                <h1 class="title">Redefinição de Senha</h1>

                <p>Olá, ${name}!</p>
                
                <p>Recebemos uma solicitação para redefinir a senha da sua conta no ${systemName}.</p>
                
                <p>Para redefinir sua senha, clique no botão abaixo:</p>

                <p style="text-align: center; margin: 35px 0;">
                    <a href="${url}" class="button">Redefinir Senha</a>
                </p>

                <p>Se o botão não funcionar, copie e cole este link em seu navegador:</p>

                <div class="url-container">${url}</div>

                <p class="footer">
                    Atenciosamente,<br>
                    <strong>Equipe ${systemName}</strong><br><br>
                    Dúvidas? Entre em contato conosco por este e-mail ou através de nosso site.
                </p>
            </div>
        </div>
    </body>
</html>
`;
