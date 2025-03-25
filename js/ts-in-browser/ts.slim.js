(function () {
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

    const transpileAndExecute = (tsCode) => {
        try {
            const jsCode = window.ts.transpileModule(tsCode, {
                compilerOptions: { module: window.ts.ModuleKind.ESNext },
            }).outputText;
            
            eval(jsCode);
        } catch (error) {
            console.error('Error transpiling or executing TypeScript code:', error);
        }
    };

    const loadAndTranspileExternalScripts = async () => {
        const scripts = Array.from(document.querySelectorAll('script[type="text/typescript"], script[src$=".ts"]'));

        for (const script of scripts) {
            if (script.src) {
                const response = await fetch(script.src);
                if (!response.ok) {
                    console.error(`Failed to load TypeScript file: ${script.src}`);
                    continue;
                }
                const tsCode = await response.text();
                transpileAndExecute(tsCode);
            } else {
                transpileAndExecute(script.textContent);
            }
        }
    };

    const initialize = async () => {
        await loadTypeScript();
        await loadAndTranspileExternalScripts(); 
    };

    initialize();
})();
