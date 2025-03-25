(function () {
    const moduleCache = new Map();

    const loadTypeScript = async () => {
        if (typeof window.ts === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/typescript/5.3.3/typescript.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
    };

    const rewriteImports = async (code, importDeclarations, referrerURL) => {
        let modifiedCode = code;
        for (const decl of [...importDeclarations].reverse()) {
            const moduleSpecifier = decl.moduleSpecifier;
            if (!ts.isStringLiteral(moduleSpecifier)) continue;
            
            const originalPath = moduleSpecifier.text;
            const absoluteURL = new URL(originalPath, referrerURL).href;
            const dataURL = await processModule(absoluteURL, referrerURL);
            
            const replacement = `"${dataURL}"`;
            const start = moduleSpecifier.getStart();
            const end = moduleSpecifier.getEnd();
            modifiedCode = modifiedCode.slice(0, start) + replacement + modifiedCode.slice(end);
        }
        return modifiedCode;
    };

    const processModule = async (url, referrerURL) => {
        if (moduleCache.has(url)) return moduleCache.get(url);

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to load module: ${url}`);
        const tsCode = await response.text();

        const sourceFile = ts.createSourceFile(
            url,
            tsCode,
            ts.ScriptTarget.ESNext,
            true
        );

        const importDeclarations = [];
        sourceFile.forEachChild(node => {
            if (ts.isImportDeclaration(node)) importDeclarations.push(node);
        });

        const modifiedCode = await rewriteImports(tsCode, importDeclarations, referrerURL);
        const jsCode = ts.transpileModule(modifiedCode, {
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
            }
        }).outputText;

        const dataURL = `data:application/javascript;base64,${btoa(jsCode)}`;
        moduleCache.set(url, dataURL);
        return dataURL;
    };

    const transpileAndExecute = (tsCode) => {
        try {
            const jsCode = ts.transpileModule(tsCode, {
                compilerOptions: { module: ts.ModuleKind.ESNext }
            }).outputText;
            eval(jsCode);
        } catch (error) {
            console.error('Transpilation/Execution Error:', error);
        }
    };

    const loadAndTranspileExternalScripts = async () => {
        const scripts = Array.from(document.querySelectorAll('script[type="text/typescript"], script[src$=".ts"]'));

        for (const script of scripts) {
            try {
                if (script.hasAttribute('data-module')) {
                    let moduleURL;
                    if (script.src) {
                        moduleURL = new URL(script.src, document.baseURI).href;
                    } else {
                        const blob = new Blob([script.textContent], { type: 'application/typescript' });
                        moduleURL = URL.createObjectURL(blob);
                    }

                    const dataURL = await processModule(moduleURL, document.baseURI);
                    const newScript = document.createElement('script');
                    newScript.type = 'module';
                    newScript.src = dataURL;
                    document.head.appendChild(newScript);
                    
                    if (!script.src) URL.revokeObjectURL(moduleURL);
                } else {
                    if (script.src) {
                        const response = await fetch(script.src);
                        if (!response.ok) {
                            console.error(`Failed to load: ${script.src}`);
                            continue;
                        }
                        const tsCode = await response.text();
                        transpileAndExecute(tsCode);
                    } else {
                        transpileAndExecute(script.textContent);
                    }
                }
            } catch (error) {
                console.error('Script Processing Error:', error);
            }
        }
    };

    const initialize = async () => {
        await loadTypeScript();
        await loadAndTranspileExternalScripts();
    };

    initialize();
})();