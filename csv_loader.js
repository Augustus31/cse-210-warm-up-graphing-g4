function createCsvLoader({ parse, onStatus }) {
    let requestId = 0;

    async function load(file) {
        if (!file) return null;
        const currentId = ++requestId;
        onStatus(`Reading ${file.name}...`);
        let text;
        try {
            text = await file.text();
        } catch {
            if (currentId === requestId) {
                onStatus('Unable to read CSV file. Please try again.');
            }
            return null;
        }
        // A newer file or manual edit takes precedence over this read.
        if (currentId !== requestId) return null;
        const result = parse(text);
        if (!result.success) {
            onStatus(result.error);
            return result;
        }
        onStatus(
            `Parsed ${result.data.length} points. X: ${result.headers.x}, Y: ${result.headers.y}` +
            result.warnings.map(warning => ` Warning: ${warning}`).join('')
        );
        return result;
    }

    function cancel() {
        requestId++;
        onStatus('');
    }

    return { load, cancel };
}
