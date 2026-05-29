const InsightOutAPIKey = "sk_98e28c820500c586771b4411c86461b8.b535eeb8da516761d0fb93d97cacf9acb268d17918a1b47e6d54588fad6ec9ae1966d2db630b559b541e4bb0328400ea5ceeac82805b74ae2847c00889413c36b5c5c4bdc46e44a23cde20c622fd5760c69c7247f19d5b65c9b9581b451ec7765be5ed5ff95d608fd7329172e33c1e62a534a10ce3ca5ea77c6fc9e85b52fd155cb02a56c0fe9b337fa9291784246e5ee0953d31392caf1e8c3139f0828d759c06b596caab2fdfcf16cea1a88ca8f08429db546558f4f8760108b7f6c8fee5b8dc72a825cca3201c6b9410a85fc98a8e48c1392421bbfadb5a774a2965d45d64942d6465398a4329f376ecaaa8ebdd1d5d9827c4960103f656819d2e4d2add971a4c2441e374a304597e7b094e7e540155b6cb4c82c8eab118d2c4b55b27483db318f9092452163817164d2861c5b9a304a44cc61b2f277a309726b8318c5f8163ccf21cf3b60b443776482e4a7b73568ae44453ad113511d435c764282799f5098d19a378435448cbdac31e007250ae7fb1e708cd470ef6b7dcd910dc9a19db3c8ea6e3e047dd2b9c2261ee7dff0422a8163d70d1eb9c510463b8236a66db62c094c5f9e44e583160b9b344de2c2b3085a926ac54c4440e36b8df4c64a8e4593c6b972f5e8e2b2ae545a8d08ca310b59538d1255fc51a4fbc6cde612f3ba8c42fa9f7c64c22143292ce45030831bb25be798ab20b4a767037eec4ad5be81824589f7b69a937d8b693c2579b6487f765";
const onLocal = false;
const mainUrl = "https://core-api-v2-e4pd.onrender.com";
var metadata: {
    baseUrl: string;
    version: string;
    app: string;
    company: string;
    organization: string;
    platform: string;
    backgroundColor: string;
    backgroundSurfaceColor: string;
    primaryTextColor: string;
    secondaryTextColor: string;
    accentColor: string;
    actionColor: string;
    backgroundColorDark: string;
    backgroundSurfaceColorDark: string;
    primaryTextColorDark: string;
    secondaryTextColorDark: string;
    accentColorDark: string;
    actionColorDark: string;
} = {
    version: "v1",
    platform: "platform-",
    organization: "organization-",
    company: "company-",
    app: "app-",
    baseUrl: "https://core-api-v2.onrender.com",
    //baseUrl: "http://localhost:10000",

    //For UI theming in the dashboard (not required, but nice to have!)
    backgroundColor: "#F1F1F1",
    backgroundColorDark: "#1E261E",
    backgroundSurfaceColor: "#F7F1E3",
    backgroundSurfaceColorDark: "#2D3A4B",
    primaryTextColor: "#3C4B3C",
    primaryTextColorDark: "#F1F1F1",
    secondaryTextColor: "#4B6584",
    secondaryTextColorDark: "#A5B1C2",
    accentColor: "#E2725B",
    accentColorDark: "#E2725B",
    actionColor: "#00D1A0",
    actionColorDark: "#00FFC2"
}


class ApiClient {
    private ACCESS_TOKEN_KEY = 'accessToken';
    private REFRESH_TOKEN_KEY = 'refreshToken';
    private apiTierToken: string | null = null;

    constructor() {
    }

    private whatMode: string | null = typeof window !== 'undefined' && localStorage.getItem("aprmode") !== null ? localStorage.getItem("aprmode") : "LIGHT";

    public async connect(apiKey: string) {
        try {
            const res = await fetch(`${mainUrl}/decrypt-api-key`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    apiKey
                })
            });
            const json = await res.json();
            if (!json.success) {
                throw new Error(json.error);
            }

            metadata = json.data;
            //alert(JSON.stringify(json.data));
            return json.data;
        } catch (err) {
            console.error("Decrypt Error:", err);
            return null;
        }

    }

    public parseTxt<T = unknown>(uncleanInput: string): T | null {
        try {
            let input = uncleanInput.trim();

            // Remove markdown fences
            input = input
                .replace(/```json/g, "")
                .replace(/```/g, "")
                .trim();

            // Find first JSON object manually
            const firstBrace = input.indexOf("{");

            if (firstBrace === -1) {
                return null;
            }

            let depth = 0;
            let endIndex = -1;

            for (let i = firstBrace; i < input.length; i++) {
                const char = input[i];

                if (char === "{") depth++;
                if (char === "}") depth--;

                if (depth === 0) {
                    endIndex = i;
                    break;
                }
            }

            if (endIndex === -1) {
                return null;
            }

            let jsonSubstring = input.slice(firstBrace, endIndex + 1);

            // Remove invalid control chars
            jsonSubstring = jsonSubstring.replace(
                /[\u0000-\u001F]/g,
                (c) => {
                    switch (c) {
                        case "\n":
                            return "\\n";
                        case "\r":
                            return "\\r";
                        case "\t":
                            return "\\t";
                        default:
                            return "";
                    }
                }
            );


            let parsed;

            try {
                parsed = JSON.parse(jsonSubstring);
            } catch (err) {
                try {
                    parsed = JSON.parse(JSON.stringify(jsonSubstring));
                } catch (err) {
                    //alert("INVALID JSON: " + jsonSubstring);
                }
            }

            return parsed as T;
        } catch (error) {
            console.error("Invalid JSON:", error);
            return null;
        }
    }

    public parseClean(value: any) {
        return JSON.parse(JSON.stringify(value));
    }

    public encodeKeys(value: string) {
        return encodeKeys(value);
    }

    public decodeKeys(value: string) {
        return decodeKeys(value);
    }

    public toggleMode() {
        if (this.whatMode === "LIGHT") {
            this.whatMode = "DARK";
            if (typeof window !== 'undefined') {
                localStorage.setItem("aprmode", "DARK");
            }
        } else {
            this.whatMode = "LIGHT";
            if (typeof window !== 'undefined') {
                localStorage.setItem("aprmode", "LIGHT");
            }
        }
    }
    public setMode(mode: "LIGHT" | "DARK") {
        this.whatMode = mode;
    }
    public isLightMode() {
        if (this.whatMode === "LIGHT") {
            return true;
        }
        return false;
    }
    public getItem(key: string): string {
        if (typeof window === "undefined") return "";
        return window.localStorage.getItem(key) || "";
    };

    public setItem(key: string, value: string) {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(key, value);
    };

    public getColor(type: "background" | "surfaceBackground" | "primaryText" | "secondaryText" | "accent" | "action") {
        if (this.whatMode === "LIGHT") {
            switch (type) {
                case "background":
                    return metadata?.backgroundColor;
                case "surfaceBackground":
                    return metadata?.backgroundSurfaceColor;
                case "primaryText":
                    return metadata?.primaryTextColor;
                case "secondaryText":
                    return metadata?.secondaryTextColor;
                case "accent":
                    return metadata?.accentColor;
                case "action":
                    return metadata?.actionColor;
            }
        } else {
            switch (type) {
                case "background":
                    return metadata?.backgroundColorDark;
                case "surfaceBackground":
                    return metadata?.backgroundSurfaceColorDark;
                case "primaryText":
                    return metadata?.primaryTextColorDark;
                case "secondaryText":
                    return metadata?.secondaryTextColorDark;
                case "accent":
                    return metadata?.accentColorDark;
                case "action":
                    return metadata?.actionColorDark;
            }
        }
    }

    public alert(message: string, hex: string) {
        customAlert(message, hex, 1370);
    }

    public pushRecord(key: string, record: any) {
        pushRecord(key, record);
    }

    public putRecords(key: string, record: any) {
        putRecords(key, record);
    }

    public pushRecords(key: string, records: any[]) {
        pushRecords(key, records);
    }

    public popRecord(key: string, filter: any, edge: SelectionEdge = "first") {
        return popRecord(key, filter, edge);
    }

    public popRecords(key: string, filter: any) {
        return popRecords(key, filter);
    }

    public findRecord(key: string, filter: any, edge: SelectionEdge = "first") {
        return findRecord(key, filter, edge);
    }

    public findRecords(key: string, filter: any) {
        return findRecords(key, filter);
    }

    public sortRecords(records: any[], comparator: RecordComparator) {
        return sortRecords(records, comparator);
    }

    public searchRecords(records: any[], fieldKey: string, query: string) {
        return searchRecords(records, fieldKey, query);
    }

    public getStoreSnapshot() {
        return getStoreSnapshot();
    }

    public hydrateStore(snapshot: any) {
        hydrateStore(snapshot);
    }

    public clearKey(key: string) {
        clearKey(key);
    }

    public deleteKey(key: string) {
        deleteKey(key);
    }

    public countRecords(key: string) {
        return countRecords(key);
    }

    public isLogin() {
        return !!this.getAccessToken();
    }

    public Logout() {
        this.clearTokens();
    }

    // ===== Token Helpers =====
    private saveTokens(accessToken: string, refreshToken?: string) {
        localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
        if (refreshToken) localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }

    private getAccessToken() {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(this.ACCESS_TOKEN_KEY);
        }
    }

    private getRefreshToken() {
        if (typeof window !== 'undefined') {
            return localStorage.getItem(this.REFRESH_TOKEN_KEY);
        }
    }

    private clearTokens() {
        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.ACCESS_TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
        }
    }

    // ===== Core Fetch Helpers =====
    private async parseResponse(res: Response) {
        const text = await res.text();
        const body = text ? (() => {
            try {
                return JSON.parse(text);
            } catch {
                return text;
            }
        })() : null;

        if (!res.ok) {
            const errorMessage = `Request failed: ${res.status} ${res.statusText}`;
            throw new Error(body.message || errorMessage);
        }

        return body;
    }

    private async nonAuthFetch(url: string, options?: RequestInit): Promise<any> {
        const res = await fetch(`${onLocal ? "http://localhost:10000" : mainUrl}/api/${metadata.version}${url}`, {
            ...options,
            headers: {
                ...(options?.headers || {}),
                ...(this.apiTierToken ? { 'X-API-TIER': this.apiTierToken } : {}),
            },
        });
        return this.parseResponse(res);
    }

    private async authFetch(url: string, options?: RequestInit): Promise<any> {
        let token = this.getAccessToken();

        const doFetch = async (accessToken: string) =>
            fetch(`${onLocal ? "http://localhost:10000" : mainUrl}/api/${metadata.version}${url}`, {
                ...options,
                headers: {
                    ...(options?.headers || {}),
                    Authorization: `Bearer ${accessToken}`,
                    ...(this.apiTierToken ? { 'X-API-TIER': this.apiTierToken } : {}),
                },
            });


        let res = await doFetch(token!);
        //alert(JSON.stringify(res));

        if (res.status === 401) {
            token = await this.refreshToken();
            res = await doFetch(token);
        }

        return this.parseResponse(res);

    }

    private setTierToken(token: string) {
        this.apiTierToken = token;
    }

    //
    //
    // Auth Endpoints
    //
    //
    async signup(id: string, password: string, link?: any, data?: any) {
        //alert(JSON.stringify(data));
        return this.nonAuthFetch('/auths/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id, password, link, data, indexData: {
                    app: metadata.app,
                    company: metadata.company,
                    organization: metadata.organization,
                    platform: metadata.platform,
                }
            }),
        });
    }

    async login(id: string, password: string) {
        const res = await this.nonAuthFetch('/auths/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password }),
        });
        if (res.success) {
            const { accessToken, refreshToken } = res.data;
            this.saveTokens(accessToken, refreshToken);
        }
        return res;
    }

    async recover(userId: string, newPassword: string) {
        return this.nonAuthFetch('/auths/recover', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, newPassword }),
        });
    }

    async refreshToken(): Promise<string> {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        const res = await fetch(`${mainUrl}/api/${metadata.version}/auths/refresh-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshToken}` },
        });

        if (!res.ok) {
            this.clearTokens();
            throw new Error('Failed to refresh token');
        }

        const data = await res.
