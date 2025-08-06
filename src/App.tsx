import React from "react";
import BuildInputForm from "./components/BuildInputForm";
import D20Icon from "./components/D20Icon";

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-parchment text-black p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-serif mb-4">
            Classi<D20Icon />
          </h1>
          <p className="text-lg font-serif max-w-2xl">
            Describe your character concept, and Classi will generate a complete level 1-12 Baldur's Gate 3 build with roleplay flavor and mechanical synergy.
          </p>
        </div>

        {/* Main content */}
        <BuildInputForm />
      </div>
    </div>
  );
};

export default App;
