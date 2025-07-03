# Jay Patel - Portfolio Website

A modern, responsive portfolio website built with plain HTML, CSS, and JavaScript.

## Features

- **Responsive Design**: Works perfectly on all devices
- **Dark/Light Theme**: Toggle between themes with smooth transitions
- **Modern CSS**: Uses CSS custom properties (variables) and modern layout techniques
- **Professional Animations**: Smooth scroll animations and hover effects
- **Clean Code**: Well-organized and maintainable code structure
- **Semantic HTML**: Accessible and SEO-friendly markup
- **No Dependencies**: Pure HTML, CSS, and JavaScript - no build tools required

## Project Structure

```
jayptl.me/
├── index.html              # Main HTML file
├── css/
│   └── main.css           # Main stylesheet with all styles
├── js/
│   └── main.js            # Main JavaScript file
├── assets/
│   └── fonts/             # Custom fonts
├── docs/                  # Documentation
└── package.json           # Project metadata
```

## Getting Started

### Option 1: Live Server (Recommended)

```bash
# Navigate to project directory
cd jayptl.me

# Start development server with live reload
npm start

# Or serve without opening browser
npm run serve
```

### Option 2: Live Server (VS Code)

1. Install Live Server extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Customization

### Colors & Theme

All colors are defined as CSS custom properties in `css/main.css`. Update the color variables in the `:root` section to change the theme:

```css
:root {
  --color-primary-500: #009688; /* Change primary color */
  --color-accent-500: #2196f3; /* Change accent color */
  /* ... other color variables */
}
```

### Content

- Update personal information in `index.html`
- Replace placeholder text with your own content
- Add your own images to the `assets/` directory
- Update contact links and social media URLs

### Styling

- All styles are in `css/main.css`
- Uses a mobile-first responsive approach
- Organized with clear sections and comments
- Uses CSS Grid and Flexbox for layouts

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Performance Features

- Optimized CSS with efficient selectors
- Lazy loading for images
- Smooth animations with `will-change` optimization
- Minimal JavaScript footprint
- No external dependencies

## License

MIT License - feel free to use this template for your own portfolio!

## Contributing

Feel free to fork this project and submit pull requests for any improvements.
