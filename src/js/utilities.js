window.sleep = async (time) => {
    return new Promise(resolve => setTimeout(resolve, time))
}

window.pad = (number, padding = 3) => {
    let zeroPad = '0'.repeat(padding)
    return (zeroPad + number).slice(-1 * padding)
}

window.toCapitalCase = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}