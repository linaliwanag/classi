# Classi 🎲

A fan-made character build generator for Baldur's Gate 3 that creates complete level 1-12 builds with roleplay flavor and mechanical synergy.

## Features

- **AI-Powered Build Generation**: Uses AI to create unique character builds based on your descriptions
- **Structured Output**: Consistent, well-formatted build tables with bullet points and clear progression
- **Parchment Theme**: Beautiful, fantasy-themed UI with serif typography and brown color scheme
- **Responsive Design**: Works perfectly on desktop and mobile devices
- **Real-time Generation**: Get your character build instantly with detailed level-by-level progression

## Screenshots

The interface features:
- Clean, parchment-like background
- D20 dice icon in the title
- Two-column layout (input and results)
- Formatted build tables with bullet points
- Professional disclaimer footer

## Tech Stack

- **Frontend**: React 19 + TypeScript
- **Styling**: Tailwind CSS 3.4
- **Build Tool**: Vite 7
- **AI Integration**: OpenRouter API with Mistral-7B model
- **Deployment**: Ready for Vercel, Netlify, or any static hosting

## Getting Started

### Prerequisites

- Node.js 20+ 
- npm or yarn
- OpenRouter API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd classi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_OPENROUTER_API_KEY=your_openrouter_api_key_here
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173`

### Getting an OpenRouter API Key

1. Visit [OpenRouter](https://openrouter.ai/)
2. Sign up for an account
3. Navigate to the API Keys section
4. Create a new API key
5. Add it to your `.env` file

## Usage

1. **Describe your character concept** in the text area
   - Examples: "a drow rogue who wants to multiclass", "a charismatic bard with healing abilities"
   - Be as specific or vague as you like

2. **Click "Generate Build"** to create your character

3. **Review the results** in the formatted table below
   - Each level shows class progression and new abilities
   - Bullet points highlight key features and choices
   - Clear reasoning for build decisions

## Project Structure

```
src/
├── components/
│   ├── BuildInputForm.tsx    # Main form and layout
│   ├── BuildTable.tsx        # Table formatting component
│   └── D20Icon.tsx          # Custom D20 dice icon
├── utils/
│   └── openai.ts            # AI integration
├── App.tsx                  # Main application component
└── index.css               # Global styles and Tailwind
```

## Customization

### Styling
The app uses Tailwind CSS with custom colors defined in `tailwind.config.js`:
- Parchment background: `#f5f5dc`
- Brown color palette for borders and accents
- Serif font family (Georgia)

### AI Prompt
Modify the system prompt in `src/utils/openai.ts` to change how builds are generated:
- Adjust the format template
- Change the AI model
- Modify temperature for creativity vs consistency

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add your environment variables in Vercel dashboard
4. Deploy!

### Netlify
1. Build the project: `npm run build`
2. Upload the `dist` folder to Netlify
3. Add environment variables in Netlify dashboard

### Other Platforms
The app builds to static files in the `dist` folder, making it compatible with any static hosting service.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Legal Notice

Classi is a fan-made tool and is not affiliated with Baldur's Gate 3, Larian Studios, or Wizards of the Coast in any capacity.

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter any issues or have suggestions for improvements, please open an issue on GitHub.
