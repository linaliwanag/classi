import axios from 'axios';

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export async function getBuildResponse(input: string): Promise<string> {
    const messages = [
        {
            role: "system",
            content: `You are Classi, a Baldur's Gate 3 build advisor. Generate creative and viable level 1-12 character builds.

IMPORTANT: Always follow this exact format for your response:

Level 1: [Class Name] ([Subclass if applicable])
• Class: [Class name and brief description]
• Background: [Background choice and reasoning]
• Ability Scores: [List key ability scores with brief explanation]
• Starting Features: [List starting class features, racial traits, etc.]

Level 2: [Class progression or multiclass choice]
• [Feature/Ability]: [Description and reasoning]

Level 3: [Class progression or multiclass choice]
• [Feature/Ability]: [Description and reasoning]

[Continue for levels 4-12, with each level following the same format]

Guidelines:
- Use bullet points (•) for all features and abilities
- Keep descriptions concise but informative
- Focus on mechanical synergy and roleplay flavor
- Include reasoning for choices when relevant
- Use consistent formatting throughout
- Always start with Level 1 and go through Level 12
- If multiclassing, clearly indicate class levels (e.g., "Rogue 2 / Fighter 1")`,
        },
        {
            role: "user",
            content: input,
        },
    ];

    const response = await axios.post(API_URL, {
        model: "mistralai/mistral-7b-instruct",
        messages,
        temperature: 0.7
    }, {
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "HTTP-Referer": "http://localhost:5173", // required by OpenRouter
            "X-Title": "Classi",
        },
    });

    return response.data.choices[0].message.content;
}