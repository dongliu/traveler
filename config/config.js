/**
 * Created by djarosz on 11/3/15.
 */
/* The purpose of this file is to load the correct directories for various project files
  *
  * The desired directory structure is as follows
  * -> Project Root Directory
  * ----> Distribution (This traveler module)
  * ----> etc
  * -------->traveler-config (directory with edited config files)
  * ----> data
  * --------> uploads (directory with uploaded data by users)
  *
  * The default directory structure if the above directory structure is as follows
  * -> Project Root Directory
  * ----> Distribution (This traveler module)
  * --------> config (directory with edited config files)
  * --------> traveler-uploads (directory with uploaded data by users)
  *
  * Specifying environment variables could also set the directories:
  * --TRAVELER_CONFIG_DIRECTORY
  * --TRAVELER_UPLOAD_DIRECTORY
  *
  * */

var fs = require('fs');
module.exports.configPath = '';
module.exports.uploadPath = '';

module.exports.loadPaths = function(){
    if (process.env.TRAVELER_CONFIG_REL_PATH) {
        module.exports.configPath=process.env.TRAVELER_CONFIG_REL_PATH;
    } else {
        module.exports.configPath = getPath('../etc/traveler-config', 'config');
    }

    if (process.env.TRAVELER_UPLOAD_REL_PATH) {
        module.exports.uploadPath = process.env.TRAVELER_UPLOAD_REL_PATH;
    } else {
        module.exports.uploadPath = getPath('../data/traveler-uploads', 'uploads');
    }
}

function getPath(desiredPath, defaultPath) {
    // Check to see that desired path exists.
    try {
        var stat = fs.statSync(desiredPath);
        if (stat != null) {
            return desiredPath;
        }
    } catch(err) {
        // Desired path was not found -- default
        return defaultPath;
    }
}