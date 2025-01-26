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

window.getID = (length = 16) => {
    let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}