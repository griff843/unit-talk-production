"""
Unit Talk Partner SDK - Python
Official SDK for interacting with Unit Talk Partner API
"""

from typing import Dict, List, Optional, Any
import requests


class UnitTalkAPIError(Exception):
    """Exception raised for Unit Talk API errors"""

    def __init__(self, message: str, status_code: Optional[int] = None, correlation_id: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.correlation_id = correlation_id
        super().__init__(self.message)


class UnitTalkClient:
    """Unit Talk Partner API Client"""

    def __init__(
        self,
        api_key: str,
        environment: str = "production",
        base_url: Optional[str] = None,
        timeout: int = 30
    ):
        """
        Initialize the Unit Talk Client

        Args:
            api_key: Your Unit Talk API key
            environment: Environment to use ('production', 'staging', 'development')
            base_url: Custom base URL (overrides environment)
            timeout: Request timeout in seconds
        """
        self.api_key = api_key
        self.timeout = timeout
        self.base_url = base_url or self._get_base_url(environment)

        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'UnitTalk-Partner-SDK-Python/1.0.0'
        })

    def _get_base_url(self, environment: str) -> str:
        """Get base URL for environment"""
        urls = {
            'production': 'https://api.unittalk.com/v1/partners',
            'staging': 'https://staging-api.unittalk.com/v1/partners',
            'development': 'http://localhost:3000/v1/partners'
        }
        return urls.get(environment, urls['production'])

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request to API"""
        url = f"{self.base_url}{endpoint}"

        try:
            response = self.session.request(
                method,
                url,
                timeout=self.timeout,
                **kwargs
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_data = e.response.json() if e.response.text else {}
            raise UnitTalkAPIError(
                error_data.get('message', str(e)),
                e.response.status_code,
                error_data.get('correlationId')
            )
        except requests.exceptions.RequestException as e:
            raise UnitTalkAPIError(str(e))

    # Picks API

    def list_picks(
        self,
        limit: int = 50,
        offset: int = 0,
        sport: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List picks with optional filters

        Args:
            limit: Number of results per page
            offset: Pagination offset
            sport: Filter by sport
            status: Filter by status
            date_from: Start date filter (ISO 8601)
            date_to: End date filter (ISO 8601)

        Returns:
            API response with picks data
        """
        params = {'limit': limit, 'offset': offset}
        if sport:
            params['sport'] = sport
        if status:
            params['status'] = status
        if date_from:
            params['date_from'] = date_from
        if date_to:
            params['date_to'] = date_to

        return self._request('GET', '/picks', params=params)

    def get_pick(self, pick_id: str) -> Dict[str, Any]:
        """Get a specific pick by ID"""
        return self._request('GET', f'/picks/{pick_id}')

    def create_pick(
        self,
        sport: str,
        market_type: str,
        selection: str,
        odds: float,
        game_date: str,
        line: Optional[float] = None,
        stake: Optional[float] = None,
        player_name: Optional[str] = None,
        team: Optional[str] = None,
        opponent: Optional[str] = None,
        game_time: Optional[str] = None,
        external_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a new pick

        Args:
            sport: Sport type (e.g., 'NFL', 'NBA')
            market_type: Market type (e.g., 'player_props')
            selection: Selection ('over', 'under', etc.)
            odds: Odds value
            game_date: Game date (ISO 8601)
            line: Line value (optional)
            stake: Stake amount (optional)
            player_name: Player name (optional)
            team: Team name (optional)
            opponent: Opponent name (optional)
            game_time: Game time (optional)
            external_id: Your pick ID (optional)
            metadata: Additional metadata (optional)

        Returns:
            API response with created pick
        """
        data = {
            'sport': sport,
            'market_type': market_type,
            'selection': selection,
            'odds': odds,
            'game_date': game_date
        }

        if line is not None:
            data['line'] = line
        if stake is not None:
            data['stake'] = stake
        if player_name:
            data['player_name'] = player_name
        if team:
            data['team'] = team
        if opponent:
            data['opponent'] = opponent
        if game_time:
            data['game_time'] = game_time
        if external_id:
            data['external_id'] = external_id
        if metadata:
            data['metadata'] = metadata

        return self._request('POST', '/picks', json=data)

    # Markets API

    def list_markets(
        self,
        limit: int = 100,
        offset: int = 0,
        sport: Optional[str] = None,
        player_name: Optional[str] = None,
        market_type: Optional[str] = None,
        game_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        List available markets

        Args:
            limit: Number of results per page
            offset: Pagination offset
            sport: Filter by sport
            player_name: Search by player name
            market_type: Filter by market type
            game_date: Filter by game date

        Returns:
            API response with markets data
        """
        params = {'limit': limit, 'offset': offset}
        if sport:
            params['sport'] = sport
        if player_name:
            params['player_name'] = player_name
        if market_type:
            params['market_type'] = market_type
        if game_date:
            params['game_date'] = game_date

        return self._request('GET', '/markets', params=params)

    # Stats API

    def get_stats(
        self,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        sport: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get performance statistics

        Args:
            date_from: Start date filter
            date_to: End date filter
            sport: Filter by sport

        Returns:
            API response with statistics
        """
        params = {}
        if date_from:
            params['date_from'] = date_from
        if date_to:
            params['date_to'] = date_to
        if sport:
            params['sport'] = sport

        return self._request('GET', '/stats', params=params)

    # Webhooks API

    def list_webhooks(self) -> Dict[str, Any]:
        """List all webhooks"""
        return self._request('GET', '/webhooks')

    def create_webhook(
        self,
        url: str,
        events: List[str]
    ) -> Dict[str, Any]:
        """
        Create a new webhook

        Args:
            url: Webhook URL
            events: List of event types to subscribe to

        Returns:
            API response with created webhook (includes secret)
        """
        data = {'url': url, 'events': events}
        return self._request('POST', '/webhooks', json=data)

    def delete_webhook(self, webhook_id: str) -> Dict[str, Any]:
        """Delete a webhook"""
        return self._request('DELETE', f'/webhooks/{webhook_id}')


__all__ = ['UnitTalkClient', 'UnitTalkAPIError']
__version__ = '1.0.0'
