<?php
// Configurações de Segurança
define('ASAAS_TOKEN', 'REMOVIDO');

// 1. Captura os cabeçalhos da requisição
$headers = getallheaders();

// Transforma as chaves em minúsculas para evitar problemas de padrão de servidor
$headers = array_change_key_case($headers, CASE_LOWER);

// 2. Verifica se o token do Asaas foi enviado e se é válido
if (!isset($headers['asaas-access-token']) || $headers['asaas-access-token'] !== ASAAS_TOKEN) {
    // Retorna erro 401 (Não autorizado) se o token estiver incorreto ou ausente
    http_response_code(401);
    echo json_encode(["error" => "Não autorizado. Token inválido ou ausente."]);
    exit;
}

// 3. Captura o corpo da requisição (Payload do Asaas)
$payloadRaw = file_get_contents('php://input');
$data = json_decode($payloadRaw, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(["error" => "Payload inválido ou vazio."]);
    exit;
}

// 4. Processa o evento enviado pelo Asaas
$evento = $data['event']; // Ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE

switch ($evento) {
    case 'PAYMENT_RECEIVED':
        // O pagamento foi recebido. Insira sua lógica de liberação aqui.
        $paymentId = $data['payment']['id'];
        $value = $data['payment']['value'];
        
        // Exemplo: Salvar no banco de dados ou atualizar status do cliente
        break;

    case 'PAYMENT_OVERDUE':
        // O pagamento está vencido.
        break;

    // Você pode adicionar outros eventos conforme a documentação do Asaas
    default:
        // Evento ignorado ou não mapeado
        break;
}

// 5. Responde ao Asaas com Status 200 (Sucesso)
// O Asaas precisa receber um status 200 para saber que o webhook foi processado,
// caso contrário, ele tentará reenviar a notificação várias vezes.
http_response_code(200);
echo json_encode(["success" => true, "message" => "Webhook processado com sucesso."]);
