export type FiscalReadinessInput = {
  catalogsLoaded: boolean;
  xsdBundlesLoaded: boolean;
  csdConfigured: boolean;
  originalStringConfigured: boolean;
  pacConfigured: boolean;
  pacHealthcheckOk: boolean;
  pacPreflightAvailable: boolean;
  testsPassing: boolean;
  certificationCorpusPassing?: boolean;
  secondReviewComplete?: boolean;
};

export type FiscalReadinessReport = {
  readyForPacSandbox: boolean;
  readyForProduction: boolean;
  sandboxBlockers: string[];
  productionBlockers: string[];
};

export function evaluateFiscalReadiness(input: FiscalReadinessInput): FiscalReadinessReport {
  const sandboxBlockers: string[] = [];
  if (!input.catalogsLoaded) sandboxBlockers.push('Faltan snapshots versionados de catálogos SAT.');
  if (!input.xsdBundlesLoaded) sandboxBlockers.push('Faltan bundles XSD locales con dependencias.');
  if (!input.csdConfigured) sandboxBlockers.push('Falta configurar CSD válido para pruebas.');
  if (!input.originalStringConfigured) sandboxBlockers.push('Falta generador de cadena original/sello integrado al flujo.');
  if (!input.pacConfigured) sandboxBlockers.push('Falta configurar PAC sandbox y credenciales.');
  if (!input.pacHealthcheckOk) sandboxBlockers.push('El PAC sandbox no ha pasado healthcheck.');
  if (!input.pacPreflightAvailable) sandboxBlockers.push('El PAC seleccionado no tiene preflight integrado o equivalente.');
  if (!input.testsPassing) sandboxBlockers.push('La suite fiscal aún no está confirmada en verde.');

  const productionBlockers = [...sandboxBlockers];
  if (!input.certificationCorpusPassing) productionBlockers.push('El corpus de certificación I/E/T/P y complementos habilitados no está confirmado en verde.');
  if (!input.secondReviewComplete) productionBlockers.push('Falta la segunda revisión independiente de la matriz fiscal y pruebas.');

  return {
    readyForPacSandbox: sandboxBlockers.length === 0,
    readyForProduction: productionBlockers.length === 0,
    sandboxBlockers,
    productionBlockers,
  };
}
