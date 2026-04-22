You are a senior Shopify theme developer.

I am building a custom Shopify theme based on an existing free Shopify theme.

Your task is to convert a Figma design section into a fully functional Shopify section that is:

- Built using Liquid, HTML, CSS, and minimal vanilla JS if needed
- Fully editable in the Shopify Theme Editor (Customize panel)
- Clean, modular, and reusable
- Optimized for performance and mobile responsiveness

SECTION DETAILS:
- Section Name: [Name of Section]
- Purpose: [Hero / Product showcase / Testimonials / etc.]
- Figma Reference: [Paste Figma link OR describe layout]

REQUIREMENTS:

1. Create a Shopify section file:
   /sections/[section-name].liquid

2. Include:
   - Semantic HTML structure
   - Scoped CSS (inside <style> or separate)
   - Minimal JS only if necessary

3. Add a complete {% schema %} with:
   - Editable text fields (headings, paragraphs)
   - Image pickers
   - Buttons (label + URL)
   - Color settings
   - Spacing (padding/margin controls)
   - Toggle options (show/hide elements)
   - Repeater blocks if needed (for cards, testimonials, etc.)

4. Make it dynamic:
   - Do NOT hardcode content
   - Everything must be editable via schema

5. Follow Shopify best practices:
   - Use {{ section.settings.* }}
   - Use {% for block in section.blocks %}
   - Use responsive image handling (image_url filters)

6. Mobile responsiveness:
   - Stack elements properly on smaller screens
   - Maintain spacing and readability

7. Performance:
   - Avoid unnecessary JS
   - Optimize images using Shopify filters

OUTPUT FORMAT:
- Full .liquid section file
- Include schema at the bottom
- Clean and well-commented code