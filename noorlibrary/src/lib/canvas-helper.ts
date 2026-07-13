// src/lib/canvas-helper.ts

/**
 * Draws multiline text on a Canvas context, wrapping words and auto-scaling font size
 * to fit within a specific bounded box.
 */
interface DrawResult {
  lines: string[];
  lineHeights: number[];
  totalHeight: number;
  fontSize: number;
}

function calculateTextLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialFontSize: number,
  maxHeight: number
): DrawResult {
  let fontSize = initialFontSize;
  const minFontSize = 15;

  while (fontSize >= minFontSize) {
    ctx.font = `500 ${fontSize}px "Georgia", "Outfit", serif`;
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    
    for (const para of paragraphs) {
      if (para.trim() === '') {
        lines.push(''); // represents empty paragraph space
        continue;
      }
      
      const words = para.split(/\s+/);
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    // Calculate total height of this layout
    let totalHeight = 0;
    const lineHeights: number[] = [];
    
    for (const line of lines) {
      if (line === '') {
        const space = fontSize * 0.7; // spacing between paragraphs
        lineHeights.push(space);
        totalHeight += space;
      } else {
        const height = fontSize * 1.45; // line height factor
        lineHeights.push(height);
        totalHeight += height;
      }
    }

    // If it fits within maxHeight, or we are at the minimum font size, return it
    if (totalHeight <= maxHeight || fontSize === minFontSize) {
      return { lines, lineHeights, totalHeight, fontSize };
    }

    // Otherwise, shrink the font and try again
    fontSize--;
  }

  // Fallback fallback return
  return { lines: [text], lineHeights: [20], totalHeight: 20, fontSize: minFontSize };
}

/**
 * Compiles a reminder's text overlay onto the template image.
 * Returns a Blob containing the generated JPEG image.
 */
export function generateReminderBlob(text: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = '/images/short-read-template.jpg';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width; // 682
      canvas.height = img.height; // 1024

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2D canvas context'));
        return;
      }

      // 1. Draw template image background
      ctx.drawImage(img, 0, 0);

      // 2. Setup text bounding box parameters
      const maxWidth = 520;  // width with safety margins
      const maxHeight = 420; // height budget in the blank middle section
      const initialFontSize = 26;
      
      // Vertical Center of the empty text region is y = 615px
      const verticalCenterY = 615; 

      // Calculate layout with wrapping & auto-scaling
      const { lines, lineHeights, totalHeight, fontSize } = calculateTextLayout(
        ctx,
        text,
        maxWidth,
        initialFontSize,
        maxHeight
      );

      // 3. Configure text drawing style
      ctx.font = `500 ${fontSize}px "Georgia", "Outfit", serif`;
      ctx.fillStyle = '#221e1a'; // Warm dark grey matching logo palette
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Enable text smoothing
      ctx.imageSmoothingEnabled = true;

      // 4. Draw each line centered horizontally and vertically
      let currentY = verticalCenterY - (totalHeight / 2);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineHeight = lineHeights[i];
        
        if (line !== '') {
          // Draw text at the center of the line block
          ctx.fillText(line, canvas.width / 2, currentY + (lineHeight / 2));
        }
        currentY += lineHeight;
      }

      // 5. Export as JPEG blob
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to generate canvas image blob'));
          }
        },
        'image/jpeg',
        0.95 // High quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load short read template image'));
    };
  });
}
