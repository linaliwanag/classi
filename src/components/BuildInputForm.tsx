import React, { useState } from 'react';
import { getBuildResponse } from '../utils/openai.ts';
import BuildTable from './BuildTable';

const BuildInputForm = () => {
    const [input, setInput] = useState('a drow rogue who wants to multiclass');
    const [build, setBuild] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const result = await getBuildResponse(input)
        setBuild(result)
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            {/* Input Section */}
            <div className="space-y-4">
                <label className="block font-serif text-lg font-semibold">
                    Describe your character:
                </label>
                <textarea
                    className="w-full p-4 border border-brown-500 rounded bg-parchment font-serif text-black resize-none"
                    rows={6}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="E.g. A drow rogue who wants to multiclass into something magical..."
                />
                <button
                    className="px-6 py-3 bg-parchment border border-brown-500 rounded font-serif text-black hover:bg-brown-100 transition-colors disabled:opacity-50"
                    type="button"
                    disabled={loading || !input}
                    onClick={handleSubmit}
                >
                    {loading ? 'Generating...' : 'Generate Build'}
                </button>
            </div>

            {/* Build Output Section */}
            {build && (
                <div className="border border-brown-500 rounded bg-parchment overflow-hidden">
                    <BuildTable build={build} />
                </div>
            )}
            {loading && (
                <div className="bg-parchment border border-brown-500 p-8 rounded text-center">
                    <p className="font-serif text-black">Generating your build...</p>
                </div>
            )}
        </div>
    )
}

export default BuildInputForm