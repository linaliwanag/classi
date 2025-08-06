import React from "react";
import BuildInputForm from "./components/BuildInputForm";
import D20Icon from "./components/D20Icon";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-brown-300 text-black">
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold font-serif mb-4">
              Classi 🎲
            </h1>
            <p className="text-lg font-serif max-w-2xl">
              Describe your character concept, and Classi will generate a complete level 1-12 Baldur's Gate 3 build with roleplay flavor and mechanical synergy.
            </p>
          </div>

          {/* Main content */}
          <BuildInputForm />
        </div>
      </div>

      {/* Disclaimer Footer */}
      <div className="mt-12 pt-6 border-t border-brown-300">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-sm text-brown-600 font-serif text-center">
            Classi is a fan-made tool and is not affiliated with Baldur's Gate 3, Larian Studios, or Wizards of the Coast in any capacity.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;
