import axios from 'axios';

const API_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

export async function getBuildResponse(input: string): Promise<string> {
    const messages = [
        {
            role: "system",
            content:
                "You are Classi, a fun and knowledgeable Baldur’s Gate 3 build advisor. Generate creative and viable level 1–12 character builds, including class, subclass, feats, and spells. Explain choices clearly.",
        },
        {
            role: "user",
            content: input,
        },
    ];

    const response = await axios.post(API_URL, {
        model: "mistralai/mistral-7b-instruct",
        messages,
        temperature: 0.8
    }, {
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            "HTTP-Referer": "http://localhost:5173", // required by OpenRouter
            "X-Title": "Classi",
        },
    });

    console.log("KEY:", API_KEY);

    return response.data.choices[0].message.content;
}