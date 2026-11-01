import gulp from 'gulp'

import { env } from '../../../config/env.js'
import { path } from '../../../config/path.js'

import { html } from '../../html/html.js'
import { meta } from '../../meta/meta.js'
import { styles } from '../../styles/styles.js'
import { scripts } from '../../scripts/scripts.js'
import { audio } from '../../assets/media/audio.js'
import { fonts } from '../../assets/fonts/fonts.js'
import { icons } from '../../assets/pictures/icons.js'
import { images } from '../../assets/pictures/images.js'
import { videos } from '../../assets/media/videos.js'
import { libs } from '../../scripts/libs.js'
import { misc } from '../../assets/misc.js'

// * --- EXPORT GULP TASK FOR WATCH KEY FILES
// * ----------------------------------------
export function watch() {
    // ! проверка на режим Tailwind
    const isTailwind = env.cssMode === 'css'

    // * 1. если Tailwind, при изменении HTML/Nunjucks нужно пересобрать и HTML/Nunjucks + CSS (параллельно)
    const htmlWatcherTasks = isTailwind ? gulp.parallel(html, styles) : html
    gulp.watch([path.watch.html, path.watch.njk, path.watch.i18n.files], htmlWatcherTasks)

    // * 2. meta-файлы
    gulp.watch(
        [
            // * смотрим все файлы
            path.watch.meta.favicon.images,
            path.watch.meta.favicon.webManifest,
            path.watch.meta.text,
        ],
        meta,
    )

    // * 3. стили (Sass или Tailwind)
    gulp.watch(path.watch.getStyles(env.cssMode).files, styles)

    // * 4. если Tailwind, классы могут добавляться динамически через JS, поэтому тоже пересобираем CSS
    const jsWatcherTasks = isTailwind ? gulp.parallel(scripts, styles) : scripts
    gulp.watch(path.watch.getScripts(env.jsMode), jsWatcherTasks)

    // * 5. ассеты
    gulp.watch(path.watch.audio, audio)
    gulp.watch(path.watch.fonts, fonts)
    gulp.watch(path.watch.icons, icons)
    gulp.watch(path.watch.images.files, images)
    gulp.watch(path.watch.videos, videos)
    gulp.watch(path.watch.libs, libs)
    gulp.watch(path.watch.misc, misc)
}

// * --- REGISTER GULP TASK
// * ----------------------
gulp.task('watch', watch)
