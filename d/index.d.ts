declare module 'sm-utils/d' {
    interface uncaughtHandlerOpts {
        /**
         * default: true
         */
        exceptions?: boolean
        /**
         * default: true
         */
        rejections?: boolean
    }

    /**
     * Colored Log to console with stack trace
     * @param args Args to log to console
     */
    function d(...args: any[]): void;

    function trace(error?: string | Error) : void;
    function getTrace(error?: Error) : any;
    function dump(...args: any[]): void;
    function enableUncaughtHandler(options?: uncaughtHandlerOpts): void;
    function disableUncaughtHandler(options?: uncaughtHandlerOpts): void;

}
