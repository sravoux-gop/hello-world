const JSON_SCHEMA = {
	name: 'blind_test_answer_validation',
	strict: true,
	schema: {
		type: 'object',
		additionalProperties: false,
		required: ['verdict', 'confidence', 'rationale', 'normalizedAnswer', 'checks'],
		properties: {
			verdict: { type: 'string', enum: ['accepted', 'rejected'] },
			confidence: { type: 'number', minimum: 0, maximum: 1 },
			rationale: { type: 'string', minLength: 1, maxLength: 300 },
			normalizedAnswer: {
				type: 'object',
				additionalProperties: false,
				required: ['title', 'artist', 'year'],
				properties: {
					title: { type: ['string', 'null'] },
					artist: { type: ['string', 'null'] },
					year: { type: ['number', 'null'] }
				}
			},
			checks: {
				type: 'object',
				additionalProperties: false,
				required: ['title', 'artist', 'year'],
				properties: {
					title: { type: 'boolean' },
					artist: { type: 'boolean' },
					year: { type: 'boolean' }
				}
			}
		}
	}
};

function normalizeValidationResult(raw) {
	return {
		verdict: raw?.verdict === 'accepted' ? 'accepted' : 'rejected',
		confidence: Number.isFinite(raw?.confidence) ? Math.max(0, Math.min(1, Number(raw.confidence))) : 0,
		rationale: String(raw?.rationale ?? 'Validation IA indisponible.'),
		normalizedAnswer: {
			title: raw?.normalizedAnswer?.title ? String(raw.normalizedAnswer.title) : null,
			artist: raw?.normalizedAnswer?.artist ? String(raw.normalizedAnswer.artist) : null,
			year: Number.isFinite(raw?.normalizedAnswer?.year) ? Number(raw.normalizedAnswer.year) : null
		},
		checks: {
			title: Boolean(raw?.checks?.title),
			artist: Boolean(raw?.checks?.artist),
			year: Boolean(raw?.checks?.year)
		},
		source: 'llm'
	};
}

function parseStructuredOutput(payload) {
	const directContent = payload?.choices?.[0]?.message?.content;
	if (typeof directContent === 'string' && directContent.trim()) {
		return JSON.parse(directContent);
	}

	const refusal = payload?.choices?.[0]?.message?.refusal;
	if (refusal) {
		throw Object.assign(new Error('llm_refused_request'), { code: 'llm_refused_request' });
	}

	throw Object.assign(new Error('llm_invalid_response'), { code: 'llm_invalid_response' });
}

export function createLlmAnswerValidatorService({ apiKey, model, timeoutMs = 8000 }) {
	const enabled = Boolean(apiKey && model);

	async function validateAnswer({ currentRound, playerAnswerText }) {
		if (!enabled) {
			throw Object.assign(new Error('llm_validation_not_configured'), { code: 'llm_validation_not_configured' });
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch('https://api.openai.com/v1/chat/completions', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model,
					temperature: 0,
					response_format: {
						type: 'json_schema',
						json_schema: JSON_SCHEMA
					},
					messages: [
						{
							role: 'system',
							content: 'Tu es un juge de blind test. Evalue si la reponse du joueur est correcte, en tolérant les variantes usuelles (ponctuation, accents, ordre des mots).'
						},
						{
							role: 'user',
							content: `Verite terrain:\n- Titre: ${currentRound.title}\n- Artiste: ${currentRound.artist}\n- Annee: ${currentRound.year}\n\nReponse libre du joueur:\n${playerAnswerText}`
						}
					]
				}),
				signal: controller.signal
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw Object.assign(new Error(`llm_http_error_${response.status}: ${errorText}`), {
					code: 'llm_http_error',
					status: response.status
				});
			}

			const payload = await response.json();
			const parsed = parseStructuredOutput(payload);
			return normalizeValidationResult(parsed);
		} catch (error) {
			if (error.name === 'AbortError') {
				throw Object.assign(new Error('llm_timeout'), { code: 'llm_timeout' });
			}
			throw error;
		} finally {
			clearTimeout(timer);
		}
	}

	return {
		enabled,
		validateAnswer
	};
}
