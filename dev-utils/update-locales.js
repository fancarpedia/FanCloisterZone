#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuration
const BASE_URL = 'https://wikicarpedia.com';
const WIKI_PATH = 'car'; // URL path component (e.g., 'wiki', 'w', 'mywiki')
const PAGE_TITLE = 'User:Bumsakalaka/JCloisterZoneLocale'; // MediaWiki page title
const OUTPUT_DIR = '../src/renderer/locales'; // Output directory for locale files
// Sent on every request. Node sends no User-Agent of its own, which makes this script
// indistinguishable from an anonymous scraper to the wiki's bot protection (Anubis). A named agent
// is something the wiki operator can allowlist so `?action=raw` answers with the page instead of a
// proof-of-work challenge. The name itself is NOT in git — it comes from FCZ_USER_AGENT in .env.
const { userAgent, isConfigured } = require('./user-agent');
const USER_AGENT = userAgent();
if (!isConfigured()) {
  console.warn(`⚠️  FCZ_USER_AGENT is not set in .env — requesting as "${USER_AGENT}".`);
  console.warn('    The wiki\'s bot gate is likely to reject that; see .env.example.');
}

// Version 20

/**
 * Discover available language translations from MediaWiki
 */
async function discoverLanguages() {
  try {
    console.log('Discovering available languages...');
    
    // Fetch the base page content to find <languages /> tag
    const pageUrl = `${BASE_URL}/${WIKI_PATH}/${PAGE_TITLE}?action=raw`;
    
    try {
      console.log('Fetching base page to find languages...');
      const content = await fetchPage(pageUrl);
      
      // Look for <languages /> tag which lists all available translations
      const languagesMatch = content.match(/<languages\s*\/>/i);
      
      if (languagesMatch) {
        // Fetch the rendered page to get the actual language links
        const renderedUrl = `${BASE_URL}/${WIKI_PATH}/${PAGE_TITLE}`;
        const renderedContent = await fetchPage(renderedUrl);
        
        // Parse language links from the rendered HTML
        // MediaWiki renders <languages /> as a list of language links
        const langPattern = new RegExp(`${PAGE_TITLE}/([a-z]{2}(?:-[A-Za-z]+)?)`, 'gi');
        const matches = [...renderedContent.matchAll(langPattern)];
        const languages = ['en', ...new Set(matches.map(m => m[1].toLowerCase()))];
        
        if (languages.length > 1) {
          console.log(`Found ${languages.length} languages: ${languages.join(', ')}`);
          return languages;
        }
      }
      
      console.log('No <languages /> tag found, trying API methods...');
    } catch (err) {
      console.log('Failed to fetch base page:', err.message);
    }
    
    // Fallback: Try Translate extension API
    const translateUrl = `${BASE_URL}/api.php?action=query&format=json&meta=messagegroupstats&mgsgroup=page-${encodeURIComponent(PAGE_TITLE)}`;
    
    try {
      console.log('Trying Translate extension API...');
      const content = await fetchPage(translateUrl);
      const data = JSON.parse(content);
      console.log('DEBUG - Translate API response:', JSON.stringify(data, null, 2));
      
      if (data.query?.messagegroupstats) {
        const languages = data.query.messagegroupstats.map(stat => stat.code);
        if (languages.length > 0) {
          console.log(`Found ${languages.length} languages via Translate API: ${languages.join(', ')}`);
          return languages;
        }
      }
    } catch (err) {
      console.log('Translate API failed:', err.message);
    }
    
    // Fallback: Query MediaWiki API for all subpages
    const namespaceMap = { 'User': 2, 'Project': 4, 'MediaWiki': 8 };
    const namespaceMatch = PAGE_TITLE.match(/^([^:]+):/);
    const namespace = namespaceMatch ? (namespaceMap[namespaceMatch[1]] || 0) : 0;
    
    const apiUrl = `${BASE_URL}/api.php?action=query&format=json&list=allpages&apprefix=${encodeURIComponent(PAGE_TITLE + '/')}&apnamespace=${namespace}&aplimit=500`;
    
    try {
      console.log('Trying allpages API...');
      const content = await fetchPage(apiUrl);
      const data = JSON.parse(content);
      console.log('DEBUG - Allpages API response:', JSON.stringify(data, null, 2));
      
      const languages = ['en'];
      
      if (data.query?.allpages) {
        data.query.allpages.forEach(page => {
          console.log('DEBUG - Found page:', page.title);
          const match = page.title.match(/\/([a-z]{2}(?:-[A-Za-z]+)?)$/i);
          if (match) {
            languages.push(match[1].toLowerCase());
          }
        });
      }
      
      if (languages.length > 1) {
        console.log(`Found ${languages.length} languages: ${languages.join(', ')}`);
        return languages;
      }
    } catch (apiError) {
      console.log('Allpages API failed:', apiError.message);
    }
    
    console.log('All automatic discovery methods failed.');
    return languagesFromLocaleFiles();

  } catch (error) {
    console.error('Failed to discover languages:', error.message);
    return languagesFromLocaleFiles();
  }
}

/**
 * Fallback language list: the locale files this repo already has.
 *
 * Discovery needs the BASE page (or api.php), and those are the one part of the wiki the bot gate
 * still blocks — the per-language /<code> subpages answer fine. Falling back to ['en'] made the
 * run LOOK successful while silently updating English only, so take the list from disk instead:
 * every language we ship has a file here, and a genuinely new one is announced by the wiki anyway.
 */
function languagesFromLocaleFiles() {
  const dir = path.resolve(__dirname, OUTPUT_DIR);
  let langs = [];
  try {
    langs = fs.readdirSync(dir)
      .filter(f => /^[a-z]{2}(-[A-Za-z]+)?\.json$/.test(f))
      .map(f => f.replace(/\.json$/, ''));
  } catch (e) {
    // no locale dir (fresh checkout) — English is all we can be sure of
  }
  if (!langs.length) {
    console.log('No locale files found either; falling back to base language only');
    return ['en'];
  }
  if (!langs.includes('en')) langs.unshift('en');
  console.log(`Using the ${langs.length} languages already in ${OUTPUT_DIR}: ${langs.join(', ')}`);
  console.log('(a NEW language on the wiki will not be picked up while the base page is gated)');
  return langs;
}

/**
 * Recognise the Anubis bot-gate page. It is served with HTTP 200, so every caller has to look at
 * the body as well as the status.
 */
function detectBotChallenge(body, headers) {
  const cookies = [].concat((headers || {})['set-cookie'] || []).join(';');
  if (/anubis/i.test(cookies) || /anubis|Making sure you(&#39;|')re not a bot|Oh noes!/i.test(body)) {
    return 'blocked by an anti-bot challenge (Anubis)';
  }
  const type = (headers || {})['content-type'] || '';
  if (/^\s*<(!doctype|html)/i.test(body) && !/text\/plain|text\/x-wiki/.test(type)) {
    return 'server returned an HTML page instead of wiki source';
  }
  return null;
}

/**
 * Fetch raw content from MediaWiki page
 */
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');
    
    protocol.get(url, { headers: { 'User-Agent': USER_AGENT } }, (res) => {
      let data = '';
      
      // Explicitly set encoding to UTF-8
      res.setEncoding('utf8')
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${url}`));
          return;
        }
        // The bot gate answers 200 with an HTML challenge page, so the status code alone proves
        // nothing. Without this the challenge HTML is treated as page content: language discovery
        // just finds no <languages /> tag and quietly carries on with English only.
        const challenge = detectBotChallenge(data, res.headers);
        if (challenge) {
          reject(new Error(`${challenge}: ${url}`));
          return;
        }
        resolve(data);
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Build a helpful error message for a JSON parse failure, showing the
 * characters surrounding the reported error position.
 */
function describeJsonError(jsonContent, parseError) {
  const posMatch = parseError.message.match(/position (\d+)/);
  if (!posMatch) {
    return parseError.message;
  }

  const pos = parseInt(posMatch[1], 10);
  const start = Math.max(0, pos - 10);
  const end = Math.min(jsonContent.length, pos + 10);
  const context = jsonContent.slice(start, end);

  // Show where the error is, with whitespace made visible
  const visible = context.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');

  return `${parseError.message}\n` +
    `  context (10 chars before/after position ${pos}): ...${visible}...`;
}

/**
 * Extract JSON content from MediaWiki page
 */
function extractJSON(content) {
  // Find the "== Locale file ==" section
  const localeMarker = '== Locale file ==';
  const markerIndex = content.indexOf(localeMarker);
  
  if (markerIndex === -1) {
    throw new Error('Locale file marker not found');
  }
  
  // Get content after the marker
  let jsonContent = content.substring(markerIndex + localeMarker.length).trim();
  
  // Remove <translate> tags but keep their content
  jsonContent = jsonContent.replace(/<\/?translate>/g, '');
  
  // Remove <span...>...</span> tags but KEEP their content (untranslated/outdated text)
  jsonContent = jsonContent.replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '');
  
  // Find the JSON object (starts with { and ends with })
  const firstBrace = jsonContent.indexOf('{');
  if (firstBrace === -1) {
    throw new Error('JSON object not found');
  }
  
  // Extract from first { to the matching }
  let braceCount = 0;
  let jsonEnd = firstBrace;
  
  for (let i = firstBrace; i < jsonContent.length; i++) {
    if (jsonContent[i] === '{') braceCount++;
    if (jsonContent[i] === '}') braceCount--;
    
    if (braceCount === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
  
  jsonContent = jsonContent.substring(firstBrace, jsonEnd);
  
  // Validate JSON
  try {
    JSON.parse(jsonContent);
    return jsonContent;
  } catch (e) {
    throw new Error(`Invalid JSON: ${describeJsonError(jsonContent, e)}`);
  }
}

/**
 * Download and process locale for a specific language
 */
async function processLanguage(lang) {
  // Always fetch from /lang suffix (including /en for English)
  const pageUrl = `${BASE_URL}/${WIKI_PATH}/${PAGE_TITLE}/${lang}?action=raw`;
  
  const filename = `${lang}.json`;
  // Resolve OUTPUT_DIR relative to script location, not cwd
  const outputDir = path.resolve(__dirname, OUTPUT_DIR);
  const filePath = path.join(outputDir, filename);
  const fileExists = fs.existsSync(filePath);
  
  try {
    console.log(`Downloading ${lang}...`);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`Created directory: ${outputDir}`);
    }
    
    const content = await fetchPage(pageUrl);
    const jsonContent = extractJSON(content);
    
    // Validate JSON by parsing it
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON structure: ${describeJsonError(jsonContent, parseError)}`);
    }
    
    // Additional validation: check if it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('JSON must be an object, not an array or primitive');
    }
    
    // Write to file with pretty formatting and explicit UTF-8 encoding
    const formatted = JSON.stringify(parsed, null, 2) + '\n'
    
    let update = false
    if (!fileExists) {
      update = true
    } else {
      const current = fs.readFileSync(filePath, 'utf8')
      if (current !== formatted) {
        update = true
      }
    }
    
    if (update) {
      fs.writeFileSync(filePath, formatted, 'utf8');
      if (!fileExists) {
        console.log(`⚠️  NEW LANGUAGE DETECTED: ${lang}.json`);
      } else {
        console.log(`✓ Updated ${filename}`);
      }
    } else {
      console.log('No changes. File not written.');
    }
    
    return { lang, success: true, updated: update, isNew: !fileExists };
  } catch (error) {
    console.error(`✗ Failed to process ${lang}: ${error.message}`);
    return { lang, success: false, updated: false, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('Starting locale update...\n');
  
  // Discover available languages dynamically
  const languages = await discoverLanguages();
  console.log('');
  
  const results = [];
  const newLanguages = [];
  const updatedLanguages = [];
  
  for (const lang of languages) {
    const result = await processLanguage(lang);
    results.push(result);
    
    if (result.success) {
      if (result.isNew) {
        newLanguages.push(lang);
      } else if (result.updated) {
        updatedLanguages.push(lang);
      }
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n=== Summary ===');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const updated = updatedLanguages.length;
  
  console.log(`Total: ${results.length} languages`);
  console.log(`Successful: ${successful}`);
  console.log(`Failed: ${failed}`);
  console.log(`Updated locales: ${updatedLanguages.join(', ')}`);
  console.log(`Updated: ${updated}`);
  
  if (newLanguages.length > 0) {
    console.log(`⚠️  NEW LANGUAGES ADDED: ${newLanguages.join(', ')}`);
  }
  
  if (failed > 0) {
    console.log('Failed languages:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.lang}: ${r.error}`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});