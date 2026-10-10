function parseCSV(text) {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0);
    // If a given csv has no data, return an error, though if we want to allow graphs with 0 points, we can
    //removes this check.
    if (lines.length === 0) {
        return {
            success: false,
            error: "CSV must have data."
        };
    }
    const firstRow = lines[0].split(",").map(value => value.trim());
    // check if the first row has exactly two columns.
    if (firstRow.length !== 2) {
        return {
            success: false,
            error: "CSV must have exactly two columns."
        };
    }
    // check whether a string is a valid number.
    function isNumeric(value) {
        return value !== "" && Number.isFinite(Number(value));
    }
    // if both values are numbers, there is no header.
    // if either value is not a number, treat the row as a header.
    const hasHeader = !(isNumeric(firstRow[0]) && isNumeric(firstRow[1]));
    let headers;
    let startRow;
    if (hasHeader) {
        // checks if headers are empty strings, if we want to allow empty headers, remove this check.
        if (firstRow[0] === "" || firstRow[1] === "") {
            return {
                success: false,
                error: "Both columns must have headers."
            };
        }
        headers = {
            x: firstRow[0],
            y: firstRow[1]
        };
        // if there is a header, we start getting data from second row.
        startRow = 1;
        if (lines.length < 2) {
            return {
                success: false,
                error: "CSV has headers but no data."
            };
        }
    } else {
        headers = {
            x: "X",
            y: "Y"
        };
        // if there is no header, we start getting data from first row.
        startRow = 0;
    }
    const data = [];
    // go through each row of the CSV and get the data.
    for (let i = startRow; i < lines.length; i++) {
        const values = lines[i].split(",").map(value => value.trim());
        // these checks make sure that the row has 2 values.
        if (values.length !== 2) {
            return {
                success: false,
                error: `Row ${i + 1} must contain exactly two values.`
            };
        }
        if (values[0] === "" || values[1] === "") {
            return {
                success: false,
                error: `Row ${i + 1} contains a missing value.`
            };
        }
        const x = Number(values[0]);
        const y = Number(values[1]);
        // checks if the values are valid numbers.
        if (!Number.isFinite(x)) {
            return {
                success: false,
                error: `Row ${i + 1}: "${values[0]}" is not a valid number.`
            };
        }
        if (!Number.isFinite(y)) {
            return {
                success: false,
                error: `Row ${i + 1}: "${values[1]}" is not a valid number.`
            };
        }
        data.push({ x, y });
    }
    return {
        success: true,
        headers,
        data
    };
}

// For now, text input has to be in CSV format, we can add more formats if wanted.
function parseTextInput(text) {
    return parseCSV(text);
}
