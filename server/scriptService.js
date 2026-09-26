const SCRIPT_PROVIDER_URL = process.env.SCRIPT_PROVIDER_URL;
const SCRIPT_PROVIDER_API_KEY = process.env.SCRIPT_PROVIDER_API_KEY;
const SCRIPT_MODEL_ID = process.env.SCRIPT_MODEL_ID;

function buildSystemPrompt() {
  return 'أنت كاتب سيناريو عربي احترافي. أكتب نصوص قابلة للتنفيذ فعليًا، واضحة، منسقة، ومناسبة للمدة المختارة. لا تكتب JSON خام. أعد السكريبت منظمًا إلى عنوان، مقدمة، مشاهد، تعليق صوتي، نهاية، CTA عند الحاجة.';
}

function cleanText(value) {
  return String(value || '').trim();
}

function parseScriptOutput(rawText) {
  const text = cleanText(rawText);

  if (!text) {
    return {
      title: 'سيناريو احترافي',
      hook: 'ابدأ بمشهد جذاب يبرز الفكرة بسرعة ووضوح.',
      scenes: [
        'المشهد الأول يضع الجو العام والرسالة الأساسية.',
        'المشهد الثاني يوضح الفكرة بالتفصيل بطريقة متدرجة.',
        'المشهد النهائي يختتم الرسالة بقوة ويترك أثرًا.',
      ],
      voiceover: 'تجربة فاخرة تلتقي بالفكرة والرسالة في مشهد موحد.',
      ending: 'اختتام هادئ ومؤثر يترك انطباعًا واضحًا في المشاهد.',
      cta: 'اكتشفه الآن وابدأ رحلتك الإبداعية.',
    };
  }

  const getSection = (labelRegex) => {
    const match = text.match(labelRegex);
    if (!match) return '';
    return match[1]?.trim() || '';
  };

  const title = getSection(/(?:العنوان|Title)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:المقدمة|Hook|Hook\/المقدمة|المشاهد|Scenes|التعليق|Voiceover|النهاية|Ending|CTA|Call To Action))/i) ||
    getSection(/(?:العنوان|Title)\s*[:\-]\s*([\n\s\S]+)/i) || 'سيناريو احترافي';

  const hook = getSection(/(?:المقدمة|Hook|Hook\/المقدمة)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:المشاهد|Scenes|التعليق|Voiceover|النهاية|Ending|CTA|Call To Action))/i) ||
    'ابدأ بمشهد جذاب يبرز الفكرة بسرعة ووضوح.';

  const sceneSource = text.match(/(?:المشاهد|Scenes)\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:التعليق|Voiceover|النهاية|Ending|CTA|Call To Action)|$)/i)?.[1] || '';
  const scenes = sceneSource
    ? sceneSource
        .split(/\n|\r\n/)
        .map((line) => line.trim())
        .filter((line) => line && !/^[-*•\d.\)]/i.test(line) ? true : line)
        .map((line) => line.replace(/^[-*•\d.\)]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : [
        'المشهد الأول يضع الجو العام والرسالة الأساسية.',
        'المشهد الثاني يوضح الفكرة بالتفصيل بطريقة متدرجة.',
        'المشهد النهائي يختتم الرسالة بقوة ويترك أثرًا.',
      ];

  const voiceover = getSection(/(?:التعليق الصوتي|Voiceover)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:النهاية|Ending|CTA|Call To Action))/i) ||
    'تجربة فاخرة تلتقي بالفكرة والرسالة في مشهد موحد.';

  const ending = getSection(/(?:النهاية|Ending)\s*[:\-]\s*([\s\S]*?)(?=\n\s*(?:CTA|Call To Action|الترويج|النداء))/i) ||
    'اختتام هادئ ومؤثر يترك انطباعًا واضحًا في المشاهد.';

  const cta = getSection(/(?:CTA|Call To Action|النداء|الترويج)\s*[:\-]\s*([\s\S]+)/i) ||
    'اكتشفه الآن وابدأ رحلتك الإبداعية.';

  return {
    title: title || 'سيناريو احترافي',
    hook: hook || 'ابدأ بمشهد جذاب يبرز الفكرة بسرعة ووضوح.',
    scenes: scenes.length ? scenes : [
      'المشهد الأول يضع الجو العام والرسالة الأساسية.',
      'المشهد الثاني يوضح الفكرة بالتفصيل بطريقة متدرجة.',
      'المشهد النهائي يختتم الرسالة بقوة ويترك أثرًا.',
    ],
    voiceover: voiceover || 'تجربة فاخرة تلتقي بالفكرة والرسالة في مشهد موحد.',
    ending: ending || 'اختتام هادئ ومؤثر يترك انطباعًا واضحًا في المشاهد.',
    cta: cta || 'اكتشفه الآن وابدأ رحلتك الإبداعية.',
  };
}

function buildScriptPrompt({ type, idea, duration, style, language, detailLevel }) {
  const normalizedType = type || 'سيناريو فيديو';
  const normalizedDuration = duration || '30 ثانية';
  const normalizedStyle = style || 'فاخر';
  const normalizedLanguage = language || 'العربية';
  const normalizedDetail = detailLevel || 'متوازن';

  return `أنت كاتب سيناريو احترافي في منصة عربية فاخرة. 

المتطلبات:
- نوع المحتوى: ${normalizedType}
- الفكرة: ${idea}
- المدة: ${normalizedDuration}
- الأسلوب: ${normalizedStyle}
- اللغة: ${normalizedLanguage}
- مستوى التفاصيل: ${normalizedDetail}

قم بكتابة سكريبت عملي ومنظم ومناسب للمدة المحددة، مع مراعاة أن يكون جاهزًا للتنفيذ الفعلي، وجميع المحتويات واضحة ومفيدة للمشاهد. 

يجب أن تكون النتيجة باللغة المطلوبة، بشكل محترف ومنظم.

التنسيق المطلوب:
العنوان
المقدمة / Hook
المشاهد
التعليق الصوتي
النهاية
CTA عند الحاجة

اكتب النتيجة مباشرة فقط، بدون شرح أو نصوص إضافية خارج السكريبت.`;
}

export async function createScriptGeneration(payload) {
  const idea = cleanText(payload.idea);

  if (!idea) {
    return {
      ok: false,
      status: 400,
      message: 'يرجى كتابة فكرة السكريبت.',
    };
  }

  if (!SCRIPT_PROVIDER_URL || !SCRIPT_PROVIDER_API_KEY || !SCRIPT_MODEL_ID) {
    return {
      ok: false,
      status: 503,
      message: 'لم يتم تهيئة مزود الكتابة في الخادم. أضف متغيرات البيئة المطلوبة.',
    };
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.SCRIPT_PROVIDER_TIMEOUT_MS || 25000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody = {
      model: SCRIPT_MODEL_ID,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildScriptPrompt(payload) },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    };

    const response = await fetch(SCRIPT_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SCRIPT_PROVIDER_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        ok: false,
        status: response.status || 500,
        message: 'تعذر إنشاء السكريبت حاليًا، حاول مرة أخرى.',
        details: errorData?.error || 'Script provider request failed',
      };
    }

    const data = await response.json();
    const rawText =
      data?.output_text ||
      data?.text ||
      data?.content ||
      data?.result ||
      data?.script ||
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      '';

    if (!rawText) {
      return {
        ok: false,
        status: 502,
        message: 'تعذر إنشاء السكريبت حاليًا، حاول مرة أخرى.',
        details: 'Script provider response did not include a usable result body',
      };
    }

    const parsed = typeof rawText === 'string' ? parseScriptOutput(rawText) : rawText;

    return {
      ok: true,
      status: 200,
      script: {
        title: parsed.title || 'سيناريو احترافي',
        hook: parsed.hook || 'ابدأ بمشهد جذاب يبرز الفكرة بسرعة ووضوح.',
        scenes: Array.isArray(parsed.scenes) && parsed.scenes.length ? parsed.scenes : [
          'المشهد الأول يضع الجو العام والرسالة الأساسية.',
          'المشهد الثاني يوضح الفكرة بالتفصيل بطريقة متدرجة.',
          'المشهد النهائي يختتم الرسالة بقوة ويترك أثرًا.',
        ],
        voiceover: parsed.voiceover || 'تجربة فاخرة تلتقي بالفكرة والرسالة في مشهد موحد.',
        ending: parsed.ending || 'اختتام هادئ ومؤثر يترك انطباعًا واضحًا في المشاهد.',
        cta: parsed.cta || 'اكتشفه الآن وابدأ رحلتك الإبداعية.',
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      message: error?.name === 'AbortError' ? 'انتهت مدة انتظار الخدمة. حاول مرة أخرى.' : 'حدث خطأ أثناء الاتصال بالخدمة.',
      details: error?.message || 'Unknown script generation error',
    };
  } finally {
    clearTimeout(timer);
  }
}
