#!/bin/bash

# Configurações
LOCAL_IMAGE_NAME="williamfernandes/backend"
CONTAINER_NAME="backend"
PORT_HOST=3000
PORT_CONTAINER=3000  # Alterado para bater com a porta da aplicação

# Função para tratamento de erros
handle_error() {
    echo "Erro: $1"
    exit 1
}

# Verifica e remove contêiner existente
stop_and_remove_container() {
    if docker ps -a | grep -q $CONTAINER_NAME; then
        echo "Parando e removendo contêiner existente..."
        docker stop $CONTAINER_NAME >/dev/null 2>&1 || handle_error "Falha ao parar contêiner"
        docker rm $CONTAINER_NAME >/dev/null 2>&1 || handle_error "Falha ao remover contêiner"
    fi
}

# Remove imagens antigas
remove_old_images() {
    echo "Removendo imagens antigas..."
    docker rmi $(docker images --filter "dangling=true" -q --no-trunc) >/dev/null 2>&1 || true
    docker rmi $LOCAL_IMAGE_NAME >/dev/null 2>&1 || true
}

# Constrói a nova imagem
build_image() {
    echo "Construindo nova imagem..."
    docker build -t $LOCAL_IMAGE_NAME . || handle_error "Falha na construção da imagem"
}

# Executa o contêiner
run_container() {
    echo "Iniciando contêiner na porta $PORT_HOST..."
    docker run -d \
        --name $CONTAINER_NAME \
        --restart unless-stopped \
        -p $PORT_HOST:$PORT_CONTAINER \
        -e NODE_ENV=production \
        -e PORT=$PORT_CONTAINER \
        -e DATABASE_URL="$DATABASE_URL" \
        $LOCAL_IMAGE_NAME || handle_error "Falha ao iniciar contêiner"
}

# Fluxo principal
stop_and_remove_container
remove_old_images
build_image
run_container

echo "Deployment concluído com sucesso!"