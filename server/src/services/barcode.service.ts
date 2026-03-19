import bwipjs from 'bwip-js';

export async function generateDataMatrixPng(
  gs1ElementString: string,
  moduleSize: number = 3
): Promise<Buffer> {
  const png = await (bwipjs.toBuffer as Function)({
    bcid: 'gs1datamatrix',
    text: gs1ElementString,
    scale: moduleSize,
    padding: 2,
    parsefnc: true,
  });
  return png as Buffer;
}
