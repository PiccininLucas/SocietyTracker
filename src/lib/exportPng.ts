import { toPng, toBlob } from 'html-to-image';

export interface ExportPngOptions {
  pixelRatio?: number;
  backgroundColor?: string;
}

/**
 * Dispara o download automático do elemento DOM renderizado como imagem PNG em alta resolução.
 */
export async function downloadElementAsPng(
  elementId: string,
  filename: string,
  options: ExportPngOptions = {}
): Promise<boolean> {
  try {
    const node = document.getElementById(elementId);
    if (!node) {
      console.warn(`[exportPng] Elemento #${elementId} não foi encontrado no DOM.`);
      return false;
    }

    const pixelRatio = options.pixelRatio ?? 2;
    const backgroundColor = options.backgroundColor ?? '#090d16';

    const dataUrl = await toPng(node, {
      pixelRatio,
      cacheBust: true,
      backgroundColor,
    });

    const link = document.createElement('a');
    link.download = `${filename.replace(/[/\\?%*:|"<>]/g, '-')}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return true;
  } catch (error) {
    console.error('[exportPng] Erro ao gerar e baixar imagem PNG:', error);
    return false;
  }
}

/**
 * Converte o elemento DOM em Blob PNG e copia diretamente para a área de transferência do usuário.
 */
export async function copyElementToClipboard(
  elementId: string,
  options: ExportPngOptions = {}
): Promise<boolean> {
  try {
    const node = document.getElementById(elementId);
    if (!node) {
      console.warn(`[exportPng] Elemento #${elementId} não foi encontrado no DOM.`);
      return false;
    }

    const pixelRatio = options.pixelRatio ?? 2;
    const backgroundColor = options.backgroundColor ?? '#090d16';

    const blob = await toBlob(node, {
      pixelRatio,
      cacheBust: true,
      backgroundColor,
    });

    if (!blob) {
      console.error('[exportPng] Falha ao converter elemento em Blob PNG.');
      return false;
    }

    if (!navigator.clipboard || !window.ClipboardItem) {
      console.warn('[exportPng] Clipboard API com suporte a imagens não está disponível neste navegador.');
      return false;
    }

    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob }),
    ]);

    return true;
  } catch (error) {
    console.error('[exportPng] Erro ao copiar imagem para área de transferência:', error);
    return false;
  }
}
