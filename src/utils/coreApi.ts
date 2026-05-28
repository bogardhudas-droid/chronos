const InsightOutApiKey = "sk_2ebebd612f54d0a33d15986a274de447.e13527c0fcd5a753b5ed2c4013294d1b8f040b241c766e119132011759cb644671350037475f27ac6c445d315d95601ee2af87bdc2bf844533d43386c11780cc8824f9d766eee8b6b1a312c1804f56c7fb0c4ad00bfaeac1e6d0c5b74e3095726b9b95f9235e4fb99ad095e64d4ca92be27aeb80c6236086e7ee6a41457c39c5bef28e247dc468e381dd1a5146ce6087433e9323fed875d5f3d5ba5bbab3035592bdf432c76949f4012292d17fc1d2a83e294662123bda626dcc155318c89be94431de2e54cafcc2c8a3cfee039b358404eb71a45513da79ab205cd8f047ba8d5c3f2601c2964a00287f441ed5f7f4b84a9272dbbfedc8bd2e5bb2e93eaedb9c13d45726f223ba3e790a50d9eee0dbccdcde3f9ccbcf7c31389450e0ebba08543e0088514f1bf6960c3e39e8de0c2cad3ad4b343050b85108c7c87e4c30f4fd3d6b90e348274ee899958adecc86b21653631511dcb3662108877a0dd4bf7ab466dc3e58762637fba80bc993a05d231e07c7affdadd114e4fd2b69ace6536f032a2bc148305c6f7813d922a2937f5c6fb8583959d20057b7bf2eff55723de1345dd3c7392a78ac35ed37d2841d84e078b9b7a51e7b9fd03ca0368053fa781b91edd043ffbfc9e696dde23b9ac3ef90154cfed2eb1d476055daaf52bbf93d8824e42d0847c8e6261d89c2ed2c3b69ef64495ff97f3f1fa36465bdd14a346be5909024e43ae69577d03a9ff8eff8d2f1608";
const onLocal = false;
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
            const res = await fetch("https://core-api-v2.onrender.com/decrypt-api-key", {
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
        const res = await fetch(`${onLocal ? "http://localhost:10000" : metadata.baseUrl}/api/${metadata.version}${url}`, {
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
            fetch(`${onLocal ? "http://localhost:10000" : metadata.baseUrl}/api/${metadata.version}${url}`, {
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

        const res = await fetch(`${metadata.baseUrl}/api/${metadata.version}/auths/refresh-token`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${refreshToken}` },
        });

        if (!res.ok) {
            this.clearTokens();
            throw new Error('Failed to refresh token');
        }

        const data = await res.json();
        const { accessToken } = data.data;
        this.saveTokens(accessToken);
        return accessToken;
    }

    async mfa(enable: boolean) {
        return await this.authFetch('/auths/mfa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enable }),
        });
    }

    /*
    async sessions() {}
    */

    //
    //
    // User Endpoints
    //
    //
    async getUsers() {
        return await this.authFetch('/users');
    }

    async getUser(userId: string) {
        const res = await this.authFetch(`/users/${encodeURIComponent(userId)}`);
        return res.user;
    }


    async createUser(payload: any) {
        return await this.authFetch('/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }

    async updateUser(userId: string, newUserId: null | string, userLink: any | null, userData: any | null) {
        const res = await this.authFetch(`/users/${encodeURIComponent(userId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: newUserId, userLink, userData }),
        });
        const { accessToken, refreshToken } = res;
        this.saveTokens(accessToken, refreshToken);
        return res;
    }

    async deleteUser(userId: string) {
        return await this.authFetch(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    }

    async updatePassword(userId: string, newPassword: string) {
        return await this.authFetch(`/users/${encodeURIComponent(userId)}/password`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newPassword }),
        });
    }

    async updateStatus(userId: string, status: string) {
        return await this.authFetch(`/users/${encodeURIComponent(userId)}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
    }

    //
    //
    // Role Endpoints
    //
    //
    async getRoles() {
        return await this.authFetch('/roles');
    }

    async getRole(roleId: string) {
        return await this.authFetch(`/roles/${roleId}`);
    }

    async patchRole(roleId: string, newRoleId: string) {
        return await this.authFetch(`/roles/${roleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId: newRoleId }),
        });
    }

    async deleteRole(roleId: string) {
        return await this.authFetch(`/roles/${roleId}`, { method: 'DELETE' });
    }

    async createRole(roleId: string) {
        return await this.authFetch('/roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roleId }),
        });
    }

    async addMemberToRole(roleId: string, userId: string) {
        return await this.authFetch(`/roles/${roleId}/members/${userId}`, { method: 'POST' });
    }

    async removeMemberFromRole(roleId: string, userId: string) {
        return await this.authFetch(`/roles/${roleId}/members/${userId}`, { method: 'DELETE' });
    }

    async transferOwner(roleId: string, newOwner: String) {
        return await this.authFetch(`/roles/${roleId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ newOwner }),
        });
    }

    async updatePermission(roleId: string, update: "push" | "pop", allowedToPushUser: string[], allowedToPopUser: string[]) {
        return await this.authFetch(`/roles/${roleId}/permissions`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ update, allowedToPushUser, allowedToPopUser }),
        });
    }

    //
    //
    // Storage Endpoints
    //
    //
    async getStorageItems(id: string, collection: string, key: string) {
        const res = await this.authFetch(`/storages/${encodeURIComponent(id)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${encodeURIComponent(collection)}/${encodeURIComponent(key)}`);

        return res?.[metadata.platform ?? ""]?.[metadata.organization ?? ""]?.[metadata.company ?? ""]?.[metadata.app ?? ""];
    }

    postStorageItems(id: string, collection: string, key: string, value: any) {
        return this.authFetch(`/storages/${encodeURIComponent(id)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${collection}/${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
        });
    }

    patchStorageItems(id: string, collection: string, key: string, value: any) {
        return this.authFetch(`/storages/${encodeURIComponent(id)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${collection}/${key}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
        });
    }

    putStorageItems(id: string, collection: string, key: string, value: any) {
        return this.authFetch(`/storages/${encodeURIComponent(id)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${encodeURIComponent(collection)}/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value }),
        });
    }



    deleteStorageItems(id: string, collection: string, key: string) {
        return this.authFetch(`/storages/${encodeURIComponent(id)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${collection}/${key}`, { method: 'DELETE' });
    }


    //=================================
    //=================================
    //======== MOST USED UTILS ========
    //=================================
    //=================================

    //await coreApi.getSelfUserId(); returns your unique username
    async getSelfUserId() {
        const res = await this.authFetch(`/users/${encodeURIComponent("#self")}`);
        return res.user.userId;
    }

    //await coreApi.getData(userIdorAnyId: string | "#self" | "#null", collection: string, key: string[] | ["#null"]); returns {key: val, ...} and if key#null {key: val, ...allKeyValPairOfCollection} and if userIdorAnyId#null return array of {userId: val, ...document}
    async getData(
        userId: string,
        collection: string,
        key: string[]
    ) {
        const keyString = key.map(k => encodeURIComponent(k)).join(",");
        const res = await this.authFetch(
            `/storages/${encodeURIComponent(userId)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${encodeURIComponent(collection)}/${keyString}`
        );
        const data =
            res?.[metadata.platform]?.[metadata.organization]?.[metadata.company]?.[metadata.app]?.[collection] || [];
        const grouped = Object.values(
            data.reduce((acc: Record<string, any>, item: Record<string, any>) => {
                const { userId, ...rest } = item;

                if (!acc[userId]) {
                    acc[userId] = { userId };
                }

                Object.assign(acc[userId], rest);

                return acc;
            }, {})
        );
        if (userId === "#null") {
            return grouped;
        } else {
            return grouped[0];
        }
    }


    //await coreApi.setData(userIdorAnyId: string | "#self", collection: string, {string: any, ...}); #self means your getSelfUserId
    setData(
        userId: string,
        collection: string,
        document: Record<string, any>
    ) {
        const keys = Object.keys(document);
        const values = Object.values(document);



        return this.authFetch(
            `/storages/${encodeURIComponent(userId)}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${encodeURIComponent(collection)}/${encodeURIComponent(keys.join(","))}`,
            {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value: values }),
            }
        );
    }

    async uploadFile(id: string, key: string, file: File) {
        const formData = new FormData();
        const safeId = id
            .replace(/#/g, "sharp")
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]/g, "");
        const safeKey = key
            .replace(/#/g, "sharp")
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]/g, "");
        formData.append("id", safeId);
        formData.append("key", safeKey);
        formData.append("file", file);

        const res = await fetch(`${metadata.baseUrl}/api/${metadata.version}/storages/upload`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.getAccessToken()}`
                // DO NOT SET Content-Type
            },
            body: formData
        });
        const data = await res.json();
        return data;
    }

    async getFiles(id: string, key: string) {
        const safeId = id
            .replace(/#/g, "sharp")
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]/g, "");
        const safeKey = key
            .replace(/#/g, "sharp")
            .replace(/\s+/g, "-")
            .replace(/[^\w\-]/g, "");
        const res = await this.authFetch(`/storages/files?id=${safeId}&key=${safeKey}`);
        return res.files[0];
    }


    //========================================
    //========================================
    //======== END OF MOST USED UTILS ========
    //========================================
    //========================================

    deleteFileItems(id: string, path: string) {
        return this.authFetch(`/storages/files/${id}/${metadata.platform}/${metadata.organization}/${metadata.company}/${metadata.app}/${path}`, { method: 'DELETE' });
    }

    //
    //
    // Process Endpoints
    //
    //
    async generateTxt(message: string, context?: string) {
        const res = await this.authFetch('/processes/generatives/txts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, context }),
        });
        return res.message;
    }

    async generateJson(payload: any) {
        return this.authFetch('/processes/generatives/jsons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
}

const coreApi = new ApiClient();
await coreApi.connect(InsightOutApiKey);
export default coreApi;




//Custom Alert
/**
 * Displays a custom styled alert overlay in the browser.
 *
 * @param text        - The message to display
 * @param hexColor    - Background color of the alert (e.g. "#ff4757")
 * @param displayTime - Duration in milliseconds before the alert auto-dismisses
 */
function customAlert(
    text: string,
    hexColor: string,
    displayTime: number
): void {
    if (typeof window === "undefined") return; // SSR guard

    const ALERT_ID = "custom-alert-overlay";

    // Remove any existing alert
    document.getElementById(ALERT_ID)?.remove();

    // ── Overlay ────────────────────────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.id = ALERT_ID;

    Object.assign(overlay.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "top",
        justifyContent: "center",
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        zIndex: "99999",
        opacity: "0",
        transition: "opacity 200ms ease",
    } satisfies Partial<CSSStyleDeclaration>);

    // ── Card ───────────────────────────────────────────────────────────────────
    const card = document.createElement("div");

    Object.assign(card.style, {
        backgroundColor: hexColor,
        color: getContrastColor(hexColor),
        padding: "28px 36px",
        borderRadius: "12px",
        maxWidth: "420px",
        width: "90%",
        height: "fit-content",
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
        fontFamily: "system-ui, -apple-system, sans-serif",
        fontSize: "16px",
        lineHeight: "1.5",
        transform: "scale(0.9)",
        transition: "transform 200ms ease",
        position: "relative",
    } satisfies Partial<CSSStyleDeclaration>);

    // ── Message ────────────────────────────────────────────────────────────────
    const message = document.createElement("p");
    message.textContent = text;
    Object.assign(message.style, {
        margin: "0 0 20px 0",
        wordBreak: "break-word",
    } satisfies Partial<CSSStyleDeclaration>);

    // ── Progress bar ───────────────────────────────────────────────────────────
    const progressWrap = document.createElement("div");
    Object.assign(progressWrap.style, {
        height: "4px",
        borderRadius: "2px",
        backgroundColor: "rgba(255,255,255,0.25)",
        overflow: "hidden",
    } satisfies Partial<CSSStyleDeclaration>);

    const progressBar = document.createElement("div");
    Object.assign(progressBar.style, {
        height: "100%",
        width: "100%",
        backgroundColor: getContrastColor(hexColor),
        opacity: "0.6",
        transition: `width ${displayTime}ms linear`,
    } satisfies Partial<CSSStyleDeclaration>);

    progressWrap.appendChild(progressBar);

    // ── Close button ───────────────────────────────────────────────────────────
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";

    Object.assign(closeBtn.style, {
        position: "absolute",
        top: "10px",
        right: "14px",
        background: "none",
        border: "none",
        color: getContrastColor(hexColor),
        fontSize: "16px",
        cursor: "pointer",
        opacity: "0.7",
        lineHeight: "1",
        padding: "0",
    } satisfies Partial<CSSStyleDeclaration>);

    // ── Dismiss logic ──────────────────────────────────────────────────────────
    const dismiss = () => {
        overlay.style.opacity = "0";
        card.style.transform = "scale(0.9)";
        setTimeout(() => overlay.remove(), 220);
    };

    closeBtn.addEventListener("click", dismiss);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) dismiss();
    });

    // ── Assemble ───────────────────────────────────────────────────────────────
    card.appendChild(closeBtn);
    card.appendChild(message);
    card.appendChild(progressWrap);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // ── Animate in ────────────────────────────────────────────────────────────
    requestAnimationFrame(() => {
        overlay.style.opacity = "1";
        card.style.transform = "scale(1)";

        // Kick off progress bar shrink on the next paint so the transition fires
        requestAnimationFrame(() => {
            progressBar.style.width = "0%";
        });
    });

    // ── Auto-dismiss ───────────────────────────────────────────────────────────
    const timer = setTimeout(dismiss, displayTime);

    // Clean up timer if card is manually dismissed before timeout
    closeBtn.addEventListener("click", () => clearTimeout(timer));
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) clearTimeout(timer);
    });
}

// ── Helper: pick black or white text based on hex background luminance ────────
function getContrastColor(hex: string): "#ffffff" | "#1a1a1a" {
    const clean = hex.replace("#", "");
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    // Perceived luminance (WCAG formula)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#1a1a1a" : "#ffffff";
}







// ─────────────────────────────────────────────────────────────────────────────
// Util for data storing
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ────────────────────────────────────────────────────────────────────

/** A plain JSON-serialisable object. */
export type JsonRecord = Record<string, unknown>;

/**
 * The global store: each key maps to an ordered array of JsonRecord objects.
 * e.g.  { users: [...], products: [...] }
 */
export type DataStore = Record<string, JsonRecord[]>;

/** Whether to operate on the first or last matching element. */
export type SelectionEdge = "first" | "last";

/**
 * A partial JsonRecord used as a match filter.
 * Every key/value pair in the filter must exist (and be equal) in the target record.
 */
export type MatchFilter = Partial<JsonRecord>;

/** A comparator that receives two records and returns a numeric sort order. */
export type RecordComparator = (a: JsonRecord, b: JsonRecord) => number;

// ── Internal state ────────────────────────────────────────────────────────────

/**
 * The singleton store for this page.
 * You may pre-populate it before importing other functions:
 *
 *   import { globalData } from "./dataStore";
 *   globalData.users = [{ id: 1, name: "Alice" }];
 */
export const globalData: DataStore = {};

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns true when every key/value pair in `filter` matches the given record.
 */
function matchesFilter(record: JsonRecord, filter: MatchFilter): boolean {
    return Object.entries(filter).every(([k, v]) => record[k] === v);
}

/**
 * Ensures a key exists in the store, initialising it to [] if absent.
 */
function ensureKey(key: string): JsonRecord[] {
    if (!Array.isArray(globalData[key])) {
        globalData[key] = [];
    }
    return globalData[key];
}

// ── Write operations ──────────────────────────────────────────────────────────

/**
 * Appends a single record to the array stored under `key`.
 *
 * @param key    - Store key (created automatically if it does not exist).
 * @param record - The JSON record to append.
 * @returns      The updated array for that key.
 *
 * @example
 * pushRecord("users", { id: 3, name: "Charlie" });
 */
function pushRecord(key: string, record: JsonRecord): JsonRecord[] {
    const bucket = ensureKey(key);
    bucket.push(record);
    return bucket;
}

/**
 * Appends multiple records to the array stored under `key`.
 *
 * @param key     - Store key.
 * @param records - Array of JSON records to append.
 * @returns       The updated array for that key.
 *
 * @example
 * pushRecords("users", [{ id: 4, name: "Dave" }, { id: 5, name: "Eve" }]);
 */
function pushRecords(key: string, records: JsonRecord[]): JsonRecord[] {
    const bucket = ensureKey(key);
    bucket.push(...records);
    return bucket;
}

function putRecords(key: string, records: JsonRecord[]): JsonRecord[] {
    deleteKey(key);
    const bucket = ensureKey(key);
    bucket.push(...records);
    return bucket;
}

/**
 * Removes **one** record that matches `filter` from the array stored under `key`.
 * Use `edge` to control whether the first or last match is removed.
 *
 * @param key    - Store key.
 * @param filter - Partial record whose key/value pairs must all match.
 * @param edge   - `"first"` (default) removes the earliest match; `"last"` removes the latest.
 * @returns      The removed record, or `null` if no match was found.
 *
 * @example
 * popRecord("users", { name: "Alice" }, "first");
 */
function popRecord(
    key: string,
    filter: MatchFilter,
    edge: SelectionEdge = "first"
): JsonRecord | null {
    const bucket = globalData[key];
    if (!bucket) return null;

    const indices = bucket.reduce<number[]>((acc, rec, i) => {
        if (matchesFilter(rec, filter)) acc.push(i);
        return acc;
    }, []);

    if (indices.length === 0) return null;

    const targetIndex = edge === "first" ? indices[0] : indices[indices.length - 1];
    const [removed] = bucket.splice(targetIndex, 1);
    return removed;
}

/**
 * Removes **all** records that match `filter` from the array stored under `key`.
 *
 * @param key    - Store key.
 * @param filter - Partial record whose key/value pairs must all match.
 * @returns      Array of removed records (empty array if none matched).
 *
 * @example
 * popRecords("users", { role: "guest" });
 */
function popRecords(key: string, filter: MatchFilter): JsonRecord[] {
    const bucket = globalData[key];
    if (!bucket) return [];

    const removed: JsonRecord[] = [];
    globalData[key] = bucket.filter((rec) => {
        if (matchesFilter(rec, filter)) {
            removed.push(rec);
            return false;
        }
        return true;
    });

    return removed;
}

// ── Read operations ───────────────────────────────────────────────────────────

/**
 * Returns **one** record from the array stored under `key` that matches `filter`.
 * Use `edge` to control whether the first or last match is returned.
 *
 * @param key    - Store key.
 * @param filter - Partial record whose key/value pairs must all match.
 * @param edge   - `"first"` (default) returns the earliest match; `"last"` returns the latest.
 * @returns      The matching record, or `null` if not found.
 *
 * @example
 * findRecord("users", { id: 2 }, "first");
 */
function findRecord(
    key: string,
    filter: MatchFilter,
    edge: SelectionEdge = "first"
): JsonRecord | null {
    const bucket = globalData[key];
    if (!bucket) return null;

    if (edge === "first") {
        return bucket.find((rec) => matchesFilter(rec, filter)) ?? null;
    }

    for (let i = bucket.length - 1; i >= 0; i--) {
        if (matchesFilter(bucket[i], filter)) return bucket[i];
    }
    return null;
}

/**
 * Returns **all** records from the array stored under `key` that match `filter`.
 *
 * @param key    - Store key.
 * @param filter - Partial record whose key/value pairs must all match.
 * @returns      Array of matching records (empty array if none matched or key absent).
 *
 * @example
 * findRecords("users", { role: "admin" });
 */
function findRecords(key: string, filter: MatchFilter): JsonRecord[] {
    const bucket = globalData[key];
    if (!bucket) return [];
    return bucket.filter((rec) => matchesFilter(rec, filter));
}

// ── Sort & Search ─────────────────────────────────────────────────────────────

/**
 * Returns a **new** sorted array from `records` without mutating the original.
 *
 * The `comparator` follows the standard `Array.prototype.sort` signature:
 *   - Return < 0  → a comes before b
 *   - Return > 0  → b comes before a
 *   - Return 0    → order is unchanged
 *
 * Built-in named comparators are available via `Comparators`.
 *
 * @param records    - Array of JSON records to sort.
 * @param comparator - Custom sort function, or one from `Comparators`.
 * @returns          A new array of the same length, sorted by the comparator.
 *
 * @example
 * // Custom formula
 * sortRecords(myList, (a, b) => (a.price as number) - (b.price as number));
 *
 * // Built-in helper
 * sortRecords(myList, Comparators.byKey("name", "alphabetical"));
 */
function sortRecords(
    records: JsonRecord[],
    comparator: RecordComparator
): JsonRecord[] {
    return [...records].sort(comparator);
}

/**
 * A collection of ready-made comparators for use with `sortRecords`.
 */
export const Comparators = {
    /**
     * Sort by a single key.
     *
     * @param key       - The record key to sort by.
     * @param direction - `"alphabetical"` (A→Z), `"reverse-alphabetical"` (Z→A),
     *                    `"ascending"` (0→9), or `"descending"` (9→0).
     */
    byKey(
        key: string,
        direction: "alphabetical" | "reverse-alphabetical" | "ascending" | "descending" = "ascending"
    ): RecordComparator {
        return (a, b) => {
            const av = a[key];
            const bv = b[key];

            if (direction === "ascending" || direction === "descending") {
                const diff = (av as number) - (bv as number);
                return direction === "ascending" ? diff : -diff;
            }

            const as = String(av ?? "");
            const bs = String(bv ?? "");
            const cmp = as.localeCompare(bs);
            return direction === "alphabetical" ? cmp : -cmp;
        };
    },

    /**
     * Sort by multiple keys in priority order.
     * The first comparator in the list takes precedence; ties fall through to the next.
     *
     * @example
     * Comparators.compound(
     *   Comparators.byKey("department", "alphabetical"),
     *   Comparators.byKey("salary", "descending")
     * )
     */
    compound(...comparators: RecordComparator[]): RecordComparator {
        return (a, b) => {
            for (const cmp of comparators) {
                const result = cmp(a, b);
                if (result !== 0) return result;
            }
            return 0;
        };
    },

    /** Sort randomly (Fisher-Yates-style shuffle via sort). */
    random(): RecordComparator {
        return () => Math.random() - 0.5;
    },
} as const;

/**
 * Performs a fuzzy search over `records` by `fieldKey`, ranking each record
 * by its similarity to `query`.
 *
 * - Returns a **new array of the same length** as `records`.
 * - Records with no value for `fieldKey` are ranked last.
 * - Matching is case-insensitive.
 * - Similarity score (higher = more similar):
 *   1. Exact match           → score 4
 *   2. Starts with query     → score 3
 *   3. Contains query        → score 2
 *   4. Shared characters (%) → score 0–1
 *
 * @param records  - Array of JSON records to search within.
 * @param fieldKey - The record key whose value is compared against `query`.
 * @param query    - The search string.
 * @returns        A new array sorted from most → least similar to `query`.
 *
 * @example
 * searchRecords(products, "name", "shoe");
 */
function searchRecords(
    records: JsonRecord[],
    fieldKey: string,
    query: string
): JsonRecord[] {
    const normalised = query.toLowerCase().trim();

    function score(record: JsonRecord): number {
        const raw = record[fieldKey];
        if (raw == null) return -1;
        const value = String(raw).toLowerCase();

        if (value === normalised) return 4;
        if (value.startsWith(normalised)) return 3;
        if (value.includes(normalised)) return 2;

        // Character-overlap ratio as a fractional score in [0, 1)
        const queryChars = new Set(normalised);
        const overlap = [...value].filter((c) => queryChars.has(c)).length;
        return overlap / Math.max(value.length, normalised.length);
    }

    return [...records].sort((a, b) => score(b) - score(a));
}



// ── Store management ──────────────────────────────────────────────────────────

/**
 * Returns a shallow snapshot of the current store (safe to serialise to JSON).
 */
function getStoreSnapshot(): DataStore {
    return Object.fromEntries(
        Object.entries(globalData).map(([k, v]) => [k, [...v]])
    );
}

/**
 * Replaces the entire store with `snapshot`.
 * Useful for hydrating from localStorage, an API, or SSR page props.
 *
 * @example
 * hydrateStore({ users: [...], products: [...] });
 */
function hydrateStore(snapshot: DataStore): void {
    Object.keys(globalData).forEach((k) => delete globalData[k]);
    Object.entries(snapshot).forEach(([k, v]) => {
        globalData[k] = [...v];
    });
}

/**
 * Removes all records for a given key without deleting the key itself.
 */
function clearKey(key: string): void {
    if (globalData[key]) globalData[key] = [];
}

/**
 * Deletes a key and its records from the store entirely.
 */
function deleteKey(key: string): void {
    delete globalData[key];
}

/**
 * Returns the number of records stored under `key`.
 */
function countRecords(key: string): number {
    return globalData[key]?.length ?? 0;
}


/**
 * Encodes dots and dollar signs in object keys so they are safe for Mongoose Maps.
 */
export function encodeKeys<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    // Handle arrays gracefully
    if (Array.isArray(obj)) {
        return obj.map(encodeKeys) as unknown as T;
    }

    const sanitizedObj: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
        // URL encode the key, then explicitly replace dots and dollar signs
        const safeKey = encodeURIComponent(key)
            .replace(/\./g, '%2E')
            .replace(/\$/g, '%24');

        // Recursively handle nested objects/values
        sanitizedObj[safeKey] = encodeKeys(value);
    }

    return sanitizedObj as T;
}

/**
 * Decodes the keys back to their original form (e.g., turning %2E back to .)
 */
export function decodeKeys<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(decodeKeys) as unknown as T;
    }

    const originalObj: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
        // Decode the key back to standard text
        const originalKey = decodeURIComponent(key);

        // Recursively decode nested values
        originalObj[originalKey] = decodeKeys(value);
    }

    return originalObj as T;
}