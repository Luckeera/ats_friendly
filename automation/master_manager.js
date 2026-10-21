const fs = require('fs');
const path = require('path');

/**
 * Master Resume Manager
 * - Manages immutable versioning of master resumes under src/master/ (v1, v2, v3, ...)
 * - Dynamically discovers and resolves the latest active version
 * - Supports targeted historical versions via argument or MASTER_RESUME_VERSION env var
 */

const DEFAULT_MASTER_DIR = path.resolve(__dirname, '../src/master');

function getMasterVersions(masterDir = DEFAULT_MASTER_DIR) {
  if (!fs.existsSync(masterDir)) {
    return [];
  }

  const entries = fs.readdirSync(masterDir, { withFileTypes: true });
  const versions = entries
    .filter(entry => entry.isDirectory() && /^v\d+$/i.test(entry.name))
    .map(entry => {
      const num = parseInt(entry.name.replace(/^v/i, ''), 10);
      const versionDir = path.join(masterDir, entry.name);
      const htmlPath = path.join(versionDir, 'master_resume.html');
      const pdfPath = path.join(versionDir, 'master_resume.pdf');
      return {
        version: entry.name.toLowerCase(),
        num,
        versionDir,
        htmlPath,
        pdfPath,
        hasHtml: fs.existsSync(htmlPath),
        hasPdf: fs.existsSync(pdfPath)
      };
    })
    .filter(v => v.hasHtml)
    .sort((a, b) => b.num - a.num);

  return versions;
}

function getMasterResumePath(version, masterDir = DEFAULT_MASTER_DIR) {
  const normVersion = version ? String(version).toLowerCase() : null;
  const versionFolder = normVersion && normVersion.startsWith('v') ? normVersion : `v${normVersion}`;
  const targetPath = path.join(masterDir, versionFolder, 'master_resume.html');

  if (!fs.existsSync(targetPath)) {
    throw new Error(`Versão do currículo mestre não encontrada: ${targetPath}`);
  }

  return targetPath;
}

function getLatestMasterResumePath(masterDir = DEFAULT_MASTER_DIR) {
  // 1. Verifica se há versão forçada via variável de ambiente
  if (process.env.MASTER_RESUME_VERSION) {
    return getMasterResumePath(process.env.MASTER_RESUME_VERSION, masterDir);
  }

  // 2. Descoberta dinâmica da versão mais alta
  const versions = getMasterVersions(masterDir);
  if (versions.length > 0) {
    return versions[0].htmlPath;
  }

  // 3. Fallback: arquivo na raiz de masterDir se existir
  const directPath = path.join(masterDir, 'master_resume.html');
  if (fs.existsSync(directPath)) {
    return directPath;
  }

  throw new Error(`Nenhum currículo mestre válido encontrado em ${masterDir}`);
}

module.exports = {
  DEFAULT_MASTER_DIR,
  getMasterVersions,
  getMasterResumePath,
  getLatestMasterResumePath
};
