import React from 'react';

interface BuildTableProps {
  build: string;
}

const BuildTable: React.FC<BuildTableProps> = ({ build }) => {
  // Parse the build string into levels and descriptions
  const parseBuild = (buildText: string) => {
    const lines = buildText.split('\n').filter(line => line.trim());
    const buildData: { level: string; description: string }[] = [];

    lines.forEach((line) => {
      // Look for level patterns like "Level 1:", "Level 2:", etc.
      const levelMatch = line.match(/Level\s+(\d+):/i);
      if (levelMatch) {
        const level = levelMatch[1];
        const description = line.replace(/Level\s+\d+:\s*/i, '').trim();
        buildData.push({ level, description });
      } else if (buildData.length > 0) {
        // If no level found, append to the last description
        buildData[buildData.length - 1].description += ' ' + line.trim();
      }
    });

    return buildData;
  };

  // Format the description text to handle bullet points and numbered lists
  const formatDescription = (description: string) => {
    // Split by common bullet point patterns
    const parts = description.split(/(?=\d+\.|•|-)/);

    if (parts.length <= 1) {
      // No bullet points found, return as is
      return <span>{description}</span>;
    }

    // Group items by type
    const groupedItems: { [key: string]: string[] } = {};
    let currentType = 'General';

    parts.forEach((part) => {
      const trimmedPart = part.trim();
      if (!trimmedPart) return;

      // Check if it's a numbered item (1. 2. etc.)
      const numberedMatch = trimmedPart.match(/^(\d+)\.\s*(.+)$/);
      if (numberedMatch) {
        const item = numberedMatch[2];

        // Try to detect the type from the item content
        const typeMatch = item.match(/^(Spells?|Traits?|Perks?|Abilities?|Features?|Skills?):\s*(.+)$/i);
        if (typeMatch) {
          currentType = typeMatch[1];
          if (!groupedItems[currentType]) {
            groupedItems[currentType] = [];
          }
          groupedItems[currentType].push(typeMatch[2]);
        } else {
          if (!groupedItems[currentType]) {
            groupedItems[currentType] = [];
          }
          groupedItems[currentType].push(item);
        }
      } else {
        // Regular text or bullet points
        if (!groupedItems[currentType]) {
          groupedItems[currentType] = [];
        }
        groupedItems[currentType].push(trimmedPart);
      }
    });

    return (
      <div className="space-y-2">
        {Object.entries(groupedItems).map(([type, items]) => (
          <div key={type} className="space-y-1">
            <div className="font-semibold text-brown-600 text-sm uppercase tracking-wide">
              {type}
            </div>
            <div className="ml-4 space-y-1">
              {items.map((item, index) => (
                <div key={index} className="flex items-start">
                  <span className="text-brown-500 mr-2 mt-1">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const buildData = parseBuild(build);

  if (buildData.length === 0) {
    return (
      <div className="bg-parchment border border-brown-500 p-4 rounded">
        <pre className="whitespace-pre-wrap font-serif text-black">{build}</pre>
      </div>
    );
  }

  return (
    <div className="bg-parchment border border-brown-500 rounded overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-brown-500">
            <th className="text-left p-3 font-serif text-black border-r border-brown-500 bg-brown-100">
              Level
            </th>
            <th className="text-left p-3 font-serif text-black">
              Build
            </th>
          </tr>
        </thead>
        <tbody>
          {buildData.map((item, index) => (
            <tr key={index} className="border-b border-brown-500 last:border-b-0">
              <td className="p-3 font-serif text-black border-r border-brown-500 bg-brown-100">
                {item.level}
              </td>
              <td className="p-3 font-serif text-black">
                {formatDescription(item.description)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BuildTable; 