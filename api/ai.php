<?php
require_once __DIR__ . '/config.php';

// ── Call AI with Claude-first, ChatGPT fallback ──────────────
function callAI(string $system, string $userMsg, int $maxTokens = 1800): string {
    $provider = getSetting('ai_provider', 'anthropic');
    $antKey   = getSetting('anthropic_api_key') ?: (defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '');
    $oaiKey   = getSetting('openai_api_key')    ?: (defined('OPENAI_API_KEY')    ? OPENAI_API_KEY    : '');

    // Try Claude first if provider is anthropic and key exists
    if ($provider === 'anthropic' && $antKey) {
        try { return callClaude($antKey, $system, $userMsg, $maxTokens); }
        catch (Throwable $e) {
            // Fallback to ChatGPT if available
            if ($oaiKey) return callOpenAI($oaiKey, $system, $userMsg, $maxTokens);
            throw $e;
        }
    }

    // Try OpenAI first if provider is openai
    if ($provider === 'openai' && $oaiKey) {
        try { return callOpenAI($oaiKey, $system, $userMsg, $maxTokens); }
        catch (Throwable $e) {
            if ($antKey) return callClaude($antKey, $system, $userMsg, $maxTokens);
            throw $e;
        }
    }

    // Try whichever key is available
    if ($antKey) return callClaude($antKey, $system, $userMsg, $maxTokens);
    if ($oaiKey) return callOpenAI($oaiKey, $system, $userMsg, $maxTokens);

    throw new Exception('No AI API key configured. Go to Admin → Settings to add your Claude or ChatGPT key.');
}

function callClaude(string $apiKey, string $system, string $userMsg, int $maxTokens): string {
    $model = getSetting('anthropic_model', 'claude-3-5-sonnet-latest');
    $payload = json_encode([
        'model'      => $model,
        'max_tokens' => $maxTokens,
        'system'     => $system,
        'messages'   => [['role' => 'user', 'content' => $userMsg]],
    ]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => implode("\r\n", [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey,
            'anthropic-version: 2023-06-01',
        ]),
        'content' => $payload,
        'timeout' => 60,
        'ignore_errors' => true,
    ]]);
    $raw = file_get_contents('https://api.anthropic.com/v1/messages', false, $ctx);
    if ($raw === false) throw new Exception('Failed to connect to Anthropic API');
    $data = json_decode($raw, true);
    if (!empty($data['error'])) throw new Exception('Claude error: ' . ($data['error']['message'] ?? 'unknown'));
    return $data['content'][0]['text'] ?? '';
}

function callOpenAI(string $apiKey, string $system, string $userMsg, int $maxTokens): string {
    $model = getSetting('openai_model', 'gpt-4o');
    $payload = json_encode([
        'model'      => $model,
        'max_tokens' => $maxTokens,
        'messages'   => [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user',   'content' => $userMsg],
        ],
    ]);
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => implode("\r\n", [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $apiKey,
        ]),
        'content' => $payload,
        'timeout' => 60,
        'ignore_errors' => true,
    ]]);
    $raw = file_get_contents('https://api.openai.com/v1/chat/completions', false, $ctx);
    if ($raw === false) throw new Exception('Failed to connect to OpenAI API');
    $data = json_decode($raw, true);
    if (!empty($data['error'])) throw new Exception('OpenAI error: ' . ($data['error']['message'] ?? 'unknown'));
    return $data['choices'][0]['message']['content'] ?? '';
}

// Parse JSON from AI response (strips markdown fences)
function callJSON(string $system, string $userMsg, int $maxTokens = 1800): array {
    $text  = callAI($system, $userMsg, $maxTokens);
    $clean = preg_replace('/^```(?:json)?\s*/m', '', $text);
    $clean = preg_replace('/```\s*$/m', '', $clean);
    $clean = trim($clean);
    $data  = json_decode($clean, true);
    if ($data !== null) return $data;
    // Try to extract JSON object/array from text
    if (preg_match('/(\{[\s\S]*\}|\[[\s\S]*\])/s', $clean, $m)) {
        $data = json_decode($m[1], true);
        if ($data !== null) return $data;
    }
    throw new Exception('AI returned invalid JSON. Please try again.');
}

// Test key connectivity
function testAIKey(string $provider): string {
    $antKey = getSetting('anthropic_api_key') ?: (defined('ANTHROPIC_API_KEY') ? ANTHROPIC_API_KEY : '');
    $oaiKey = getSetting('openai_api_key')    ?: (defined('OPENAI_API_KEY')    ? OPENAI_API_KEY    : '');
    if ($provider === 'anthropic') {
        if (!$antKey) throw new Exception('No Anthropic key set');
        callClaude($antKey, 'You are a test.', 'Reply with just: OK', 10);
        return 'Claude connection successful';
    } else {
        if (!$oaiKey) throw new Exception('No OpenAI key set');
        callOpenAI($oaiKey, 'You are a test.', 'Reply with just: OK', 10);
        return 'ChatGPT connection successful';
    }
}
