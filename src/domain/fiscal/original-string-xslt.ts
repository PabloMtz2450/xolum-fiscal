import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import type { OriginalStringGenerator } from './xml-signing-pipeline';

export type XsltProcOptions = {
  executable?: string;
  xsltPath: string;
  timeoutMs?: number;
};

/**
 * Genera la cadena original usando el XSLT oficial SAT almacenado localmente.
 * Se usa --nonet para impedir que libxslt intente resolver recursos remotos en
 * tiempo de facturación. Todas las imports/includes del XSLT deben existir en
 * el bundle local versionado.
 */
export class XsltProcOriginalStringGenerator implements OriginalStringGenerator {
  constructor(private readonly options: XsltProcOptions) {}

  async generate(xmlWithoutSeal: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'xolum-cadena-'));
    const xmlPath = join(dir, 'cfdi.xml');
    try {
      await writeFile(xmlPath, xmlWithoutSeal, 'utf8');
      const output = await runProcess(
        this.options.executable ?? 'xsltproc',
        ['--nonet', this.options.xsltPath, xmlPath],
        this.options.timeoutMs ?? 10_000,
      );
      const cadena = output.trim();
      if (!cadena) throw new Error('El XSLT no produjo cadena original.');
      return cadena;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

function runProcess(command: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Tiempo excedido ejecutando ${command}.`));
    }, timeoutMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(`xsltproc terminó con código ${code}: ${stderr.trim() || 'sin detalle'}`));
    });
  });
}
