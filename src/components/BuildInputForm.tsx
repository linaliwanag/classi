import React, { useState } from 'react';
import { getBuildResponse } from '../utils/openai.ts';

const BuildInputForm = () => {
    const [input, setInput] = useState('');
    const [build, setBuild] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        console.log("API KEY:", import.meta.env.VITE_OPENROUTER_API_KEY);
        e.preventDefault();
        setLoading(true);
        const result = await getBuildResponse(input)
        setBuild(result)
        setLoading(false)
    }

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <form onSubmit={handleSubmit}>
                <label className="block font-semibold mb-2">
                    Describe your character.
                </label>
                <textarea
                    className="w-full p-3 border border-gray-300 rounded-md"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="E.g. A drow rogue who wants to multiclass into something magical..."
                />
                <button className="mt-3 px-4 py-2 bg-purple-700 text-white rounded hover:bg-purple-800"
                    type="submit"
                    disabled={loading || !input}
                >
                    {loading ? 'Generating...' : 'Generate Build'}
                </button>
            </form>

            {
                build && (
                    <div className="mt-6 bg-gray-100 p-4 rounded whitespace-pre-wrap">
                        {build}
                    </div>
                )
            }
        </div>
    )
}

export default BuildInputForm