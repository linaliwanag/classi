import React from 'react';

interface BuildTableProps {
  build: string;
}

const BuildTable: React.FC<BuildTableProps> = ({ build }) => {
  // Parse the build string into levels and descriptions
  const parseBuild = (buildText: string) => {
    const lines = buildText.split('\n').filter(line => line.trim());
    const buildData: { level: string; description: string }[] = [];
    
    lines.forEach((line, index) => {
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
                {item.description}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BuildTable; 