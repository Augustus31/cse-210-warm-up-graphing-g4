const SVG_NS = 'http://www.w3.org/2000/svg';
const STYLE_PROPERTIES = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity',
  'stroke-linecap', 'stroke-linejoin', 'font-size', 'font-weight',
  'font-style', 'text-anchor', 'opacity',
];

export function serializeGraph(svg) {
  if (!svg) throw new Error('Add at least one complete X/Y pair before saving.');

  const copy = svg.cloneNode(true);
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  originals.forEach((element, index) => {
    const style = getComputedStyle(element);
    for (const property of STYLE_PROPERTIES) {
      copies[index].style.setProperty(property, style.getPropertyValue(property));
    }
    // Use an offline font fallback; the page's Google font is not embedded.
    copies[index].style.setProperty('font-family', 'Georgia, serif');
  });

  const { width, height } = svg.viewBox.baseVal;
  copy.setAttribute('xmlns', SVG_NS);
  copy.setAttribute('width', width);
  copy.setAttribute('height', height);
  return new XMLSerializer().serializeToString(copy);
}

async function toRaster(svgBlob, width, height, format) {
  const mimeType = `image/${format}`;
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Unable to render the graph image.'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    // Render at twice the SVG dimensions for sharper text in documents.
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image export is not available.');
    if (format === 'jpeg') {
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob?.type === mimeType) resolve(blob);
        else reject(new Error(`${format.toUpperCase()} export is not available.`));
      }, mimeType, 0.95);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveGraph(container, format = 'svg') {
  if (!['svg', 'jpeg', 'png'].includes(format)) throw new Error('Unsupported image format.');
  const svg = container.querySelector('svg');
  const source = serializeGraph(svg);
  const title = svg.querySelector('.chart-title')?.textContent || 'graph';
  const name = title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim().replace(/[. ]+$/g, '').slice(0, 100) || 'graph';
  const filename = `${name}.${format === 'jpeg' ? 'jpg' : format}`;
  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const { width, height } = svg.viewBox.baseVal;
  const blob = format === 'svg' ? svgBlob : await toRaster(svgBlob, width, height, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    // Let the browser start consuming the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return filename;
}
