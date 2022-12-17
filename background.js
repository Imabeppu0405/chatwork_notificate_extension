/**
 * To以外のメッセージも通知するかどうかグループごとに設定し、設定に応じて通知を行うスクリプト
 * （設定は [グループチャットの設定 > ミュート] から可能）
 */

/**
 * To以外のメッセージも通知するグループのIDリスト（chromeのstrageで管理）
 */
let unmuteRoomIds = [];

/**
 * 画面のロード後に、初期設定を行いたい、、
 * （なぜかgetElementByIdがNULLになるので、秒数を指定して少し待ってから実行）
 */
window.addEventListener('load', () => {
    setTimeout(() => {
        initSettingObserver();
        initNotificationObserver();

        // chromeのstrageの監視。変更があれば、再度設定を行う。
        chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace == "sync") {
            initNotificationObserver();
        }
    });
    }, 100);
}, false);

/**
 * 通知用のオブザーバインスタンス
 * 
 * 該当のグループにメッセージが来た時に、通知を行う
 */
const NotificationObserver = new MutationObserver(records => {
    //  要素追加（1つ目の通知）、文字データ変更（2つ目以降の通知）の場合通知
    isAddNotification = records[0].type === 'characterData';
    isNotMentioned = records[0].addedNodes.length > 0 && typeof records[0].addedNodes[0].firstChild.dataset.testid === 'undefined';
    if(isAddNotification || isNotMentioned ) {
        const roomName = records[0].target.parentElement.closest('li[role="listitem"]').getAttribute('aria-label');
        new Notification(roomName);
    }
});

/**
 * To以外のメッセージも通知するグループのIDリストを取得し、通知用オブザーバを起動する
 */
function initNotificationObserver() {
    chrome.storage.sync.get("unmuteRoomIds", function(value){ 
        unmuteRoomIds = value.unmuteRoomIds ?? [];
        setNotificationObserver(unmuteRoomIds);
    });
}

/**
 * 通知用のオブザーバの監視を一度解除し、監視対象のノードと設定を渡して再起動
 */
function setNotificationObserver(unmuteRoomIds) {
    // 監視を解除
    NotificationObserver.disconnect();

    // 監視対象のノードと設定を渡す
    unmuteRoomIds.forEach(roomId => {
        const target = document.querySelector('li[data-rid="' + roomId + '"]');
        NotificationObserver.observe(target, {
            childList: true, // 子要素監視
            characterData: true, // 文字データ監視
            subtree: true // 孫要素監視
        });
    });
}

/**
 * グループID設定用のオブザーバインスタンス
 * 
 * 設定画面が開かれたときに、グループID設定用の要素を配置し、更新用のイベントを設定する
 */
const Settingobserver = new MutationObserver(records => {
    const addedNode = records[0].addedNodes[0];
    // 変更が要素の追加かつ、追加された要素に「グループチャットの設定」という文字列があれば、、、
    if(addedNode && addedNode.innerText.substring(0,11) === 'グループチャットの設定') {
        const roomId = addedNode.baseURI.slice(-9).replace(/[^0-9]/g, "");
        appendEditElement(roomId);
        setUpdateEvent(roomId);
    };
})

/**
 * グループID設定用のオブザーバを起動する
 */
function initSettingObserver() {
    const target = document.getElementById('RootModalsEntryPoint');
    setSettingObserver(target);
}

/**
 * グループID設定用のオブザーバに監視対象のノードと設定を渡す
 */
function setSettingObserver(target) {
    Settingobserver.observe(target, {
        childList: true, // 子要素監視
    });
}

/**
 * 更新用のHTML要素の配置
 */
function appendEditElement(roomId) {
    const EditElement = document.createElement('label');
    // ルームIDがすでに設定されている場合は、チェック済みにする
    const checked = unmuteRoomIds.includes(roomId) ? 'checked' : '';
    EditElement.innerHTML = '<input id="_roomSettingUnmute" name="unmute" type="checkbox" value="1"' + checked + '><span>To以外も通知を行う</span>';
    document.getElementById('_roomSettingMute').closest('.roomMuteSettingDialog__inputContainer').appendChild(EditElement);
}

/**
 * 更新用クリックイベントの設定
 */
function setUpdateEvent(roomId) {
    const saveButton = document.querySelector('button[data-testid="room-setting-dialog_save-button"]');
    saveButton.addEventListener('click', () => {
        // チェックの有無で更新処理を分ける
        if(document.getElementById('_roomSettingUnmute').checked) {
            add(roomId);
        } else {
            remove(roomId);
        };
    })
}

/**
 * To以外のメッセージも通知するグループのIDリストにIDを追加
 */
function add(roomId) {
    chrome.storage.sync.get("unmuteRoomIds", function(value){
        if (typeof value.unmuteRoomIds === 'undefined') {
            // 初回はデータが存在しないため新たに作成する
            value.unmuteRoomIds = [roomId];
        } else {
            // 該当のルームIDがリストにない場合のみ追加する
            if(!value.unmuteRoomIds.includes(roomId)) {
                value.unmuteRoomIds.push(roomId);
            }
        }
        chrome.storage.sync.set({"unmuteRoomIds": value.unmuteRoomIds}, function(){ });
     });
}

/**
 * To以外のメッセージも通知するグループのIDリストからIDを削除
 */
function remove(roomId) {
    chrome.storage.sync.get("unmuteRoomIds", function(value){
        // IDリストが定義済かつ該当のルームIDが存在するとき、ルームIDを指定して削除
        if (typeof value.unmuteRoomIds !== 'undefined' && value.unmuteRoomIds.includes(roomId)) {
            value.unmuteRoomIds.splice(value.unmuteRoomIds.indexOf(roomId), 1);
            chrome.storage.sync.set({"unmuteRoomIds": value.unmuteRoomIds}, function(){ });
        }
    });
}