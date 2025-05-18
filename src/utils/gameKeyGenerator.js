const generateGameKey = () => {
  const timestamp = Date.now().toString(36).toUpperCase(); // Convert timestamp to base36
  const random = Math.random().toString(36).substring(2, 4).toUpperCase(); // Get 2 random chars
  const key = (timestamp + random).slice(-6); // Take last 6 characters
  
  // Ensure it's exactly 6 characters by padding with random letters if needed
  while (key.length < 6) {
    key = key + Math.random().toString(36).substring(2, 3).toUpperCase();
  }
  
  return key;
};

module.exports = generateGameKey; 